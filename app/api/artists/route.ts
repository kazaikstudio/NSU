import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export async function GET() {
  try {
    await ensureDatabaseReady();
    const { rows } = await pool.query('SELECT * FROM artists ORDER BY created_at DESC');
    return NextResponse.json({ artists: rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const { name, genre, tracksCount = 0, status = 'Active' } = await request.json();

    const artistId = `artist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const query = `
      INSERT INTO artists (artist_id, name, genre, tracks_count, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [artistId, name, genre, tracksCount, status];
    const { rows } = await pool.query(query, values);

    return NextResponse.json({ artist: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
