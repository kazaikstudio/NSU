import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { deleteFromGoogleDrive, uploadToGoogleDrive } from '@/lib/google-drive';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

async function ensureMediaTable() {
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    await ensureMediaTable();
    const { rows } = await pool.query(
      `SELECT id, kind, title, album, file_name AS "fileName", mime_type AS "mimeType", file_url AS "fileUrl", created_at AS "createdAt"
       FROM artist_media WHERE artist_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json({ media: rows });
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

    const driveFile = await uploadToGoogleDrive({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      bytes: await file.arrayBuffer(),
    });
    await ensureMediaTable();

    const previousMedia = kind === 'banner' || kind === 'profile'
      ? await pool.query<{ id: string; driveFileId: string | null }>(
        `SELECT id, drive_file_id AS "driveFileId" FROM artist_media WHERE artist_id = $1 AND kind = $2`,
        [artistId, kind]
      )
      : { rows: [] as { id: string; driveFileId: string | null }[] };

    const mediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const mediaTitle = title.trim() || (kind === 'banner' ? 'Artist Banner' : 'Artist Profile');
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

    return NextResponse.json({ media: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}