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
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE artist_media
    ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0
  `);
}

export async function GET() {
  try {
    await ensureMediaTable();
    const { rows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM artist_media WHERE kind = 'track'`
    );
    return NextResponse.json({ totalUploads: Number(rows[0]?.total || 0) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
