import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export const runtime = 'nodejs';

let pinnedTableReady: Promise<void> | null = null;

async function ensurePinnedColumn() {
  if (pinnedTableReady) return pinnedTableReady;

  pinnedTableReady = (async () => {
    await ensureDatabaseReady();
    await pool.query(`
      ALTER TABLE artist_media
      ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false
    `);
  })().catch((error) => {
    pinnedTableReady = null;
    throw error;
  });

  return pinnedTableReady;
}

export async function GET() {
  try {
    await ensurePinnedColumn();
    const { rows } = await pool.query<{ fileUrl: string }>(
      `SELECT file_url AS "fileUrl"
       FROM artist_media
       WHERE kind = 'track' AND pinned = true
       ORDER BY sort_order ASC, created_at DESC`,
    );
    return NextResponse.json({ fileUrls: rows.map((row) => row.fileUrl) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, fileUrls: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensurePinnedColumn();
    const body = await request.json().catch(() => ({}));
    const fileUrls = Array.isArray(body.fileUrls)
      ? body.fileUrls.filter((url: unknown): url is string => typeof url === 'string')
      : [];

    // One-shot sync: mark exactly the given file_urls as pinned, unpin the rest.
    await ensureDatabaseReady();
    await pool.query(
      `UPDATE artist_media
       SET pinned = (file_url = ANY($1::text[]))
       WHERE kind = 'track'`,
      [fileUrls],
    );

    const { rows } = await pool.query<{ fileUrl: string }>(
      `SELECT file_url AS "fileUrl"
       FROM artist_media
       WHERE kind = 'track' AND pinned = true
       ORDER BY sort_order ASC, created_at DESC`,
    );
    return NextResponse.json({ fileUrls: rows.map((row) => row.fileUrl) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, fileUrls: [] }, { status: 500 });
  }
}