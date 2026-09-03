import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export const runtime = 'nodejs';

const fallbackTracks = [
  {
    id: 'fallback-track-1',
    title: 'Studio Demo',
    album: 'Noll Studio',
    fileName: 'studio-demo.mp3',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    createdAt: new Date().toISOString(),
    artistId: 'fallback-artist',
    artistName: 'Noll Studio',
    artistGenre: 'Creative',
    artistProfileUrl: null,
  },
];

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
      thumbnail_url TEXT,
      thumbnail_drive_file_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE artist_media
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS storage_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      drive_file_id TEXT,
      thumbnail_url TEXT,
      thumbnail_drive_file_id TEXT,
      source TEXT NOT NULL DEFAULT 'talk-show',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`);
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
        media.drive_file_id AS "driveFileId",
        media.thumbnail_url AS "thumbnailUrl",
        media.thumbnail_drive_file_id AS "thumbnailDriveFileId",
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
    const { rows: storageRows } = await pool.query(`
      SELECT title, file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl"
      FROM storage_items
      WHERE LOWER(type) = 'music'
      ORDER BY created_at DESC
    `);

    if (!rows?.length) {
      return NextResponse.json({ tracks: fallbackTracks, storageItems: storageRows, fallback: true });
    }

    return NextResponse.json({ tracks: rows, storageItems: storageRows, fallback: false });
  } catch (error) {
    console.error('Audio route failed, falling back to demo tracks.', error);
    return NextResponse.json({ tracks: fallbackTracks, fallback: true });
  }
}