import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export const runtime = 'nodejs';

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

export async function GET() {
  try {
    await ensureMediaTable();
    const { rows } = await pool.query(`
      SELECT
        media.id,
        media.title,
        media.album,
        media.file_name AS "fileName",
        media.file_url AS "fileUrl",
        media.created_at AS "createdAt",
        artist.id::text AS "artistId",
        artist.name AS "artistName",
        artist.genre AS "artistGenre",
        artist.profile_url AS "artistProfileUrl"
      FROM artist_media AS media
      INNER JOIN artists AS artist ON artist.id::text = media.artist_id
      WHERE media.kind = 'track'
      ORDER BY media.created_at DESC
    `);

    return NextResponse.json({ tracks: rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}