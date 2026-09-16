import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export const runtime = 'nodejs';

async function ensureMediaCounters() {
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
      play_count INTEGER NOT NULL DEFAULT 0,
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE artist_media
    ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0
  `);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: driveFileId } = await context.params;
  if (!driveFileId || !/^[a-zA-Z0-9_-]+$/.test(driveFileId)) {
    return NextResponse.json({ error: 'Invalid media file id' }, { status: 400 });
  }

  try {
    await ensureMediaCounters();
    const mediaResult = await pool.query<{
      trackPlays: number;
      trackDownloads: number;
      artistTotalPlays: number;
      artistTotalDownloads: number;
    }>(
      `SELECT am.play_count AS "trackPlays",
              am.download_count AS "trackDownloads",
              artists.total_plays AS "artistTotalPlays",
              artists.total_downloads AS "artistTotalDownloads"
       FROM artist_media am
       LEFT JOIN artists ON artists.id::text = am.artist_id
       WHERE am.drive_file_id = $1 AND am.kind = 'track'
       LIMIT 1`,
      [driveFileId]
    );

    const media = mediaResult.rows[0];
    if (!media) return NextResponse.json({ error: 'Track not found' }, { status: 404 });

    return NextResponse.json({
      trackPlays: Number(media.trackPlays || 0),
      trackDownloads: Number(media.trackDownloads || 0),
      artistTotalPlays: Number(media.artistTotalPlays || 0),
      artistTotalDownloads: Number(media.artistTotalDownloads || 0),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
