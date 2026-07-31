import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';

async function ensureArtistsTable() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        genre TEXT NOT NULL,
        tracks_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active',
        bio TEXT DEFAULT '',
        followers INTEGER DEFAULT 0,
        featured_track TEXT DEFAULT '',
        monthly_listeners INTEGER DEFAULT 0,
        banner_url TEXT,
        profile_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE artists
      ADD COLUMN IF NOT EXISTS artist_id TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS tracks_count INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active',
      ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS featured_track TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS monthly_listeners INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS banner_url TEXT,
      ADD COLUMN IF NOT EXISTS profile_url TEXT
    `);

    await client.query(`
      ALTER TABLE artists
      ALTER COLUMN artist_id DROP NOT NULL,
      ALTER COLUMN email DROP NOT NULL
    `);
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    await ensureArtistsTable();

    const { rows } = await pool.query(`
      SELECT id::text AS id, name, genre, tracks_count AS "tracksCount", status, profile_url AS "profileUrl"
      FROM artists
      ORDER BY created_at DESC, name ASC
    `);

    return NextResponse.json({
      artists: rows.map((row) => ({
        id: row.id,
        name: row.name,
        genre: row.genre,
        tracksCount: Number(row.tracksCount || 0),
        status: row.status || 'Active',
        profileUrl: row.profileUrl || null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const genre = typeof body?.genre === 'string' ? body.genre.trim() : '';

    if (!name || !genre) {
      return NextResponse.json({ error: 'Artist name and genre are required' }, { status: 400 });
    }

    await ensureArtistsTable();

    const artistId = `artist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await pool.query(
      `
        INSERT INTO artists (artist_id, name, genre, tracks_count, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id::text AS id, name, genre, tracks_count AS "tracksCount", status, profile_url AS "profileUrl"
      `,
      [artistId, name, genre, 0, 'Active']
    );

    const artist = result.rows[0];
    await recordActivity({
      action: 'created',
      entityType: 'artist',
      entityId: String(artist.id),
      description: `Created artist ${artist.name}`,
    });

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        tracksCount: Number(artist.tracksCount || 0),
        status: artist.status || 'Active',
        profileUrl: artist.profileUrl || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

