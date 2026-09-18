import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { saveFileLocally } from '@/lib/local-storage';
import { deleteStoredObject, uploadToBucket } from '@/lib/railway-storage';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };
let mediaTableReady = false;

async function ensureMediaTable() {
  if (mediaTableReady) return;

  await ensureDatabaseReady();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_media (
      id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      album TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      drive_file_id TEXT,
      thumbnail_url TEXT,
      thumbnail_drive_file_id TEXT,
      featured_artist_name TEXT,
      play_count INTEGER NOT NULL DEFAULT 0,
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE artist_media
    ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS featured_artist_name TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS featured_artist_id TEXT,
    ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false
  `);

  mediaTableReady = true;
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    await ensureMediaTable();
    const { rows } = await pool.query(
      `SELECT m.id, m.kind, m.title, m.album, m.featured_artist_name AS "featuredArtistName", m.file_name AS "fileName", m.mime_type AS "mimeType", m.file_url AS "fileUrl", m.drive_file_id AS "driveFileId", m.thumbnail_url AS "thumbnailUrl", m.play_count AS "playCount", m.download_count AS "downloadCount", m.created_at AS "createdAt", m.featured_artist_id AS "featuredArtistId", m.artist_id AS "ownerArtistId",
              (SELECT a.name FROM artists a WHERE a.id::text = m.artist_id) AS "ownerArtistName"
       FROM artist_media m
       WHERE m.artist_id = $1 OR m.featured_artist_id = $1
       ORDER BY m.sort_order ASC, m.created_at DESC`,
      [id]
    );
    return NextResponse.json({ media: rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: Context) {
  const { id: artistId } = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');
    if (!mediaId) {
      return NextResponse.json({ error: 'A media id is required' }, { status: 400 });
    }

    const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');
    const body = isMultipart ? await request.formData() : await request.json().catch(() => ({}));
    const title = isMultipart
      ? (body.get('title') as string | null)?.trim() || ''
      : typeof body?.title === 'string' ? body.title.trim() : '';
    const album = isMultipart
      ? (body.get('album') as string | null)?.trim() || ''
      : typeof body?.album === 'string' ? body.album.trim() : '';
    const featuredArtistName = isMultipart
      ? (body.get('featuredArtistName') as string | null)?.trim() || ''
      : typeof body?.featuredArtistName === 'string' ? body.featuredArtistName.trim() : '';
    const thumbnail = isMultipart ? body.get('thumbnail') : null;

    if (!title && !(thumbnail instanceof File)) {
      return NextResponse.json({ error: 'Track title is required' }, { status: 400 });
    }

    await ensureMediaTable();
    if (thumbnail instanceof File && !thumbnail.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 });
    }

    let thumbnailUrl: string | null = null;
    let thumbnailDriveFileId: string | null = null;
    if (thumbnail instanceof File) {
      const storageFile = await uploadToBucket({
        name: `artist-thumbnail-${Date.now()}-${thumbnail.name}`,
        mimeType: thumbnail.type,
        bytes: await thumbnail.arrayBuffer(),
      });
      thumbnailUrl = storageFile.publicUrl;
      thumbnailDriveFileId = storageFile.id;
    }

    const previousThumbnail = thumbnail instanceof File
      ? await pool.query<{ thumbnailUrl: string | null; thumbnailDriveFileId: string | null }>(
        `SELECT thumbnail_url AS "thumbnailUrl", thumbnail_drive_file_id AS "thumbnailDriveFileId"
         FROM artist_media WHERE id = $1 AND artist_id = $2`,
        [mediaId, artistId]
      )
      : { rows: [] };

    const { rows } = await pool.query<{ id: string; kind: string; title: string; album: string | null; fileName: string; fileUrl: string; thumbnailUrl: string | null; createdAt: string }>(
      `UPDATE artist_media
       SET title = COALESCE(NULLIF($1, ''), title), album = COALESCE(NULLIF($2, ''), album),
             featured_artist_name = NULLIF($3, ''), thumbnail_url = COALESCE($4, thumbnail_url), thumbnail_drive_file_id = COALESCE($5, thumbnail_drive_file_id)
      WHERE id = $6 AND artist_id = $7
           RETURNING id, kind, title, album, featured_artist_name AS "featuredArtistName", file_name AS "fileName", file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", created_at AS "createdAt"`,
          [title, album, featuredArtistName, thumbnailUrl, thumbnailDriveFileId, mediaId, artistId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const previous = previousThumbnail.rows[0];
    if (thumbnail instanceof File && previous?.thumbnailDriveFileId) {
      await Promise.allSettled([deleteStoredObject(previous.thumbnailDriveFileId)]);
    }

    await recordActivity({
      action: 'updated',
      entityType: 'track',
      entityId: mediaId,
      description: `Updated media ${mediaId} for artist ${artistId}`,
    });

    return NextResponse.json({ media: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const { id: artistId } = await context.params;
  try {
    const body = await request.json().catch(() => ({})) as { trackIds?: unknown };
    const rawTrackIds = Array.isArray(body.trackIds) ? body.trackIds : [];
    const trackIds = rawTrackIds.filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (trackIds.length === 0) {
      return NextResponse.json({ error: 'An ordered list of track ids is required' }, { status: 400 });
    }

    await ensureMediaTable();

    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM artist_media WHERE artist_id = $1 AND kind = 'track'`,
      [artistId]
    );
    const ownedIds = new Set(rows.map((row) => row.id));
    if (trackIds.some((id) => !ownedIds.has(id))) {
      return NextResponse.json({ error: 'One or more track ids do not belong to this artist' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let index = 0; index < trackIds.length; index += 1) {
        await client.query(`UPDATE artist_media SET sort_order = $1 WHERE id = $2 AND artist_id = $3`, [index + 1, trackIds[index], artistId]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await recordActivity({
      action: 'updated',
      entityType: 'track',
      entityId: artistId,
      description: `Reordered ${trackIds.length} tracks for artist ${artistId}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id: artistId } = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get('mediaId');

    if (!mediaId) {
      return NextResponse.json({ error: 'A media id is required' }, { status: 400 });
    }

    await ensureMediaTable();
    const { rows } = await pool.query<{ id: string; driveFileId: string | null; thumbnailDriveFileId: string | null; kind: string }>(
      `SELECT id, kind, drive_file_id AS "driveFileId", thumbnail_drive_file_id AS "thumbnailDriveFileId" FROM artist_media WHERE id = $1 AND artist_id = $2`,
      [mediaId, artistId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const media = rows[0];
    if (media.driveFileId || media.thumbnailDriveFileId) {
      await Promise.allSettled([
        ...(media.driveFileId ? [deleteStoredObject(media.driveFileId)] : []),
        ...(media.thumbnailDriveFileId ? [deleteStoredObject(media.thumbnailDriveFileId)] : []),
      ]);
    }

    await pool.query(`DELETE FROM artist_media WHERE id = $1 AND artist_id = $2`, [mediaId, artistId]);

    await recordActivity({
      action: 'deleted',
      entityType: 'track',
      entityId: mediaId,
      description: `Deleted media ${mediaId} for artist ${artistId}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const { id: artistId } = await context.params;
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const kind = formData.get('kind');
    const title = String(formData.get('title') || '');
    const album = String(formData.get('album') || '') || null;
    const featuredArtistName = String(formData.get('featuredArtistName') || '').trim() || null;
    const featuredArtistIdInput = String(formData.get('featuredArtistId') || '').trim() || null;
    const thumbnail = formData.get('thumbnail');

    if (!(file instanceof File) || (kind !== 'banner' && kind !== 'profile' && kind !== 'track')) {
      return NextResponse.json({ error: 'A file and valid media kind are required' }, { status: 400 });
    }
    if (kind === 'track' && !title.trim()) {
      return NextResponse.json({ error: 'Track title is required' }, { status: 400 });
    }

    let thumbnailUrl: string | null = null;
    let thumbnailDriveFileId: string | null = null;
    if (thumbnail instanceof File && thumbnail.type.startsWith('image/')) {
      try {
        const thumbnailFile = await uploadToBucket({
          name: `artist-track-cover-${Date.now()}-${thumbnail.name}`,
          mimeType: thumbnail.type,
          bytes: await thumbnail.arrayBuffer(),
        });
        thumbnailUrl = thumbnailFile.publicUrl;
        thumbnailDriveFileId = thumbnailFile.id;
      } catch (error) {
        console.warn('Unable to upload extracted track cover', error);
      }
    }

    let storageFile: { id: string; publicUrl: string; name: string; mimeType: string };
    let uploadError: string | null = null;
    const uploadName = title.trim() || file.name;
    try {
      storageFile = await uploadToBucket({
        name: uploadName,
        mimeType: file.type || 'application/octet-stream',
        bytes: await file.arrayBuffer(),
      });
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error);
      console.warn('Bucket upload failed, falling back to local storage', uploadError);
      storageFile = await saveFileLocally({
        name: uploadName,
        mimeType: file.type || 'application/octet-stream',
        bytes: await file.arrayBuffer(),
      });
    }

    try {
      await ensureMediaTable();

      const previousMedia = kind === 'banner' || kind === 'profile'
        ? await pool.query<{ id: string; driveFileId: string | null }>(
          `SELECT id, drive_file_id AS "driveFileId" FROM artist_media WHERE artist_id = $1 AND kind = $2`,
          [artistId, kind]
        )
        : { rows: [] as { id: string; driveFileId: string | null }[] };

      const mediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const mediaTitle = title.trim() || (kind === 'banner' ? 'Artist Banner' : kind === 'profile' ? 'Artist Profile' : 'Track');
      const sortOrder = kind === 'track'
        ? (await pool.query<{ sortOrder: number }>(
          `SELECT COALESCE(MIN(sort_order) - 1, 0) AS "sortOrder" FROM artist_media WHERE artist_id = $1 AND kind = 'track'`,
          [artistId]
        )).rows[0].sortOrder
        : 0;

      let resolvedFeaturedArtistId: string | null = null;
      if (featuredArtistIdInput && kind === 'track') {
        const featuredArtistResult = await pool.query<{ id: string }>(
          'SELECT id::text AS id FROM artists WHERE id = $1',
          [featuredArtistIdInput]
        );
        if (featuredArtistResult.rows.length > 0) {
          resolvedFeaturedArtistId = featuredArtistResult.rows[0].id;
        }
      }

      const { rows } = await pool.query(
        `INSERT INTO artist_media (id, artist_id, kind, title, album, featured_artist_name, featured_artist_id, file_name, mime_type, file_url, drive_file_id, thumbnail_url, thumbnail_drive_file_id, download_count, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,0,$14)
         RETURNING id, kind, title, album, featured_artist_name AS "featuredArtistName", featured_artist_id AS "featuredArtistId", artist_id AS "ownerArtistId", (SELECT a.name FROM artists a WHERE a.id::text = artist_media.artist_id) AS "ownerArtistName", file_name AS "fileName", mime_type AS "mimeType", file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", download_count AS "downloadCount", created_at AS "createdAt"`,
        [mediaId, artistId, kind, mediaTitle, album, featuredArtistName, resolvedFeaturedArtistId, file.name, file.type || 'application/octet-stream', storageFile.publicUrl, storageFile.id, thumbnailUrl, thumbnailDriveFileId, sortOrder]
      );

      if (kind === 'banner' || kind === 'profile') {
        await pool.query(`UPDATE artists SET ${kind === 'banner' ? 'banner_url' : 'profile_url'} = $1 WHERE id::text = $2`, [storageFile.publicUrl, artistId]);
        await pool.query('DELETE FROM artist_media WHERE id = ANY($1::text[])', [previousMedia.rows.map((media) => media.id)]);
        await Promise.allSettled(
          previousMedia.rows
            .map((media) => media.driveFileId)
            .filter((fileId): fileId is string => Boolean(fileId))
            .map((fileId) => deleteStoredObject(fileId))
        );
      }

      await recordActivity({
        action: kind === 'track' ? 'uploaded' : 'replaced',
        entityType: kind === 'track' ? 'track' : 'artist_media',
        entityId: mediaId,
        description: `${kind === 'track' ? 'Uploaded' : 'Replaced'} ${kind} file ${file.name} for artist ${artistId}${resolvedFeaturedArtistId ? ` and shared with artist ${resolvedFeaturedArtistId}` : ''}`,
      });

      return NextResponse.json({ media: rows[0], uploadError }, { status: 201 });
    } catch (error) {
      console.warn('Unable to persist media metadata; returning local upload metadata instead', error);
      return NextResponse.json({
        media: {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          title: title.trim() || (kind === 'banner' ? 'Artist Banner' : kind === 'profile' ? 'Artist Profile' : 'Track'),
          album,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileUrl: storageFile.publicUrl,
          thumbnailUrl,
          downloadCount: 0,
          createdAt: new Date().toISOString(),
        },
        uploadError,
      }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}