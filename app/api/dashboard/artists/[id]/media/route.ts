import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { deleteFromGoogleDrive, saveFileLocally, uploadToGoogleDrive } from '@/lib/google-drive';
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
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE artist_media
    ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT
  `);

  mediaTableReady = true;
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    await ensureMediaTable();
    const { rows } = await pool.query(
      `SELECT id, kind, title, album, file_name AS "fileName", mime_type AS "mimeType", file_url AS "fileUrl", drive_file_id AS "driveFileId", thumbnail_url AS "thumbnailUrl", download_count AS "downloadCount", created_at AS "createdAt"
       FROM artist_media WHERE artist_id = $1 ORDER BY created_at DESC`,
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
      const driveFile = await uploadToGoogleDrive({
        name: `artist-thumbnail-${Date.now()}-${thumbnail.name}`,
        mimeType: thumbnail.type,
        bytes: await thumbnail.arrayBuffer(),
      });
      thumbnailUrl = driveFile.publicUrl;
      thumbnailDriveFileId = driveFile.id;
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
           thumbnail_url = COALESCE($3, thumbnail_url), thumbnail_drive_file_id = COALESCE($4, thumbnail_drive_file_id)
       WHERE id = $5 AND artist_id = $6
       RETURNING id, kind, title, album, file_name AS "fileName", file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", created_at AS "createdAt"`,
      [title, album, thumbnailUrl, thumbnailDriveFileId, mediaId, artistId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const previous = previousThumbnail.rows[0];
    if (thumbnail instanceof File && previous?.thumbnailDriveFileId) {
      await Promise.allSettled([deleteFromGoogleDrive(previous.thumbnailDriveFileId)]);
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
        ...(media.driveFileId ? [deleteFromGoogleDrive(media.driveFileId)] : []),
        ...(media.thumbnailDriveFileId ? [deleteFromGoogleDrive(media.thumbnailDriveFileId)] : []),
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

    if (!(file instanceof File) || (kind !== 'banner' && kind !== 'profile' && kind !== 'track')) {
      return NextResponse.json({ error: 'A file and valid media kind are required' }, { status: 400 });
    }
    if (kind === 'track' && !title.trim()) {
      return NextResponse.json({ error: 'Track title is required' }, { status: 400 });
    }

    let driveFile: { id: string; publicUrl: string; name: string; mimeType: string };
    let uploadError: string | null = null;
    try {
      driveFile = await uploadToGoogleDrive({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        bytes: await file.arrayBuffer(),
      });
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error);
      console.warn('Google Drive upload failed, falling back to local storage', uploadError);
      driveFile = await saveFileLocally({
        name: file.name,
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
      const { rows } = await pool.query(
        `INSERT INTO artist_media (id, artist_id, kind, title, album, file_name, mime_type, file_url, drive_file_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, kind, title, album, file_name AS "fileName", mime_type AS "mimeType", file_url AS "fileUrl", created_at AS "createdAt"`,
        [mediaId, artistId, kind, mediaTitle, album, file.name, file.type || 'application/octet-stream', driveFile.publicUrl, driveFile.id]
      );

      if (kind === 'banner' || kind === 'profile') {
        await pool.query(`UPDATE artists SET ${kind === 'banner' ? 'banner_url' : 'profile_url'} = $1 WHERE id::text = $2`, [driveFile.publicUrl, artistId]);
        await pool.query('DELETE FROM artist_media WHERE id = ANY($1::text[])', [previousMedia.rows.map((media) => media.id)]);
        await Promise.allSettled(
          previousMedia.rows
            .map((media) => media.driveFileId)
            .filter((fileId): fileId is string => Boolean(fileId))
            .map((fileId) => deleteFromGoogleDrive(fileId))
        );
      }

      await recordActivity({
        action: kind === 'track' ? 'uploaded' : 'replaced',
        entityType: kind === 'track' ? 'track' : 'artist_media',
        entityId: mediaId,
        description: `${kind === 'track' ? 'Uploaded' : 'Replaced'} ${kind} file ${file.name} for artist ${artistId}`,
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
          fileUrl: driveFile.publicUrl,
          createdAt: new Date().toISOString(),
        },
        uploadError,
      }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}