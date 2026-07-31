import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export async function GET() {
  try {
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
    const { rows } = await pool.query(`
      SELECT
        artists.id::text AS id,
        artists.name,
        artists.genre,
        COUNT(media.id) FILTER (WHERE media.kind = 'track')::int AS "tracksCount",
        artists.status,
        artists.profile_url AS "profileUrl"
      FROM artists
      LEFT JOIN artist_media AS media ON media.artist_id = artists.id::text
      GROUP BY artists.id, artists.name, artists.genre, artists.status, artists.profile_url, artists.created_at
      ORDER BY artists.created_at DESC
    `);

    return NextResponse.json({
      artists: rows.map((artist) => ({
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        tracksCount: Number(artist.tracksCount || 0),
        status: artist.status || 'Active',
        profileUrl: artist.profileUrl || null,
      })),
    });
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
