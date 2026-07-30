import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { artistsSeed } from '@/lib/artists';

export const runtime = 'nodejs';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

let pool: Pool | null = null;

if (connectionString) {
  pool = new Pool({ connectionString });
}

const fallbackArtists = artistsSeed.map((artist) => ({
  id: artist.id,
  name: artist.name,
  genre: artist.genre,
  tracksCount: artist.tracksCount,
  status: artist.status,
}));

async function ensureArtistsTable() {
  if (!pool) {
    return;
  }

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
      ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS featured_track TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS monthly_listeners INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS banner_url TEXT,
      ADD COLUMN IF NOT EXISTS profile_url TEXT
    `);
  } finally {
    client.release();
  }
}

export async function GET() {
  if (!pool) {
    return NextResponse.json({ artists: fallbackArtists });
  }

  try {
    await ensureArtistsTable();

    const { rows } = await pool.query(`
      SELECT id, name, genre, tracks_count AS "tracksCount", status
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
      })),
    });
  } catch (error) {
    console.warn('Falling back to seeded artists because PostgreSQL is unavailable', error);
    return NextResponse.json({ artists: fallbackArtists });
  }
}

export async function POST(request: Request) {
  if (!pool) {
    const fallbackArtist = {
      id: `artist-local-${Date.now()}`,
      name: 'Local Artist',
      genre: 'Independent',
      tracksCount: 0,
      status: 'Active',
    };

    return NextResponse.json({ artist: fallbackArtist });
  }

  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const genre = typeof body?.genre === 'string' ? body.genre.trim() : '';

    if (!name || !genre) {
      return NextResponse.json({ error: 'Artist name and genre are required' }, { status: 400 });
    }

    await ensureArtistsTable();

    const id = `artist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await pool.query(
      `
        INSERT INTO artists (id, name, genre, tracks_count, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, genre, tracks_count AS "tracksCount", status
      `,
      [id, name, genre, 0, 'Active']
    );

    const artist = result.rows[0];

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        tracksCount: Number(artist.tracksCount || 0),
        status: artist.status || 'Active',
      },
    });
  } catch (error) {
    console.warn('Falling back to a local artist response because PostgreSQL is unavailable', error);
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : 'Local Artist';
    const genre = typeof body?.genre === 'string' ? body.genre.trim() : 'Independent';
    const fallbackArtist = {
      id: `artist-local-${Date.now()}`,
      name,
      genre,
      tracksCount: 0,
      status: 'Active',
    };

    return NextResponse.json({ artist: fallbackArtist });
  }
}
