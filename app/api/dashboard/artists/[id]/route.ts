import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

let pool: Pool | null = null;

if (connectionString) {
  pool = new Pool({ connectionString });
}

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!pool) {
    return NextResponse.json({ artist: null });
  }

  try {
    const { id } = await context.params;

    await ensureArtistsTable();

    const { rows } = await pool.query(
      `
        SELECT
          id,
          name,
          genre,
          tracks_count AS "tracksCount",
          status,
          bio,
          followers,
          featured_track AS "featuredTrack",
          monthly_listeners AS "monthlyListeners",
          banner_url AS "bannerUrl",
          profile_url AS "profileUrl"
        FROM artists
        WHERE id = $1
      `,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    const artist = rows[0];

    return NextResponse.json({
      artist: {
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        tracksCount: Number(artist.tracksCount || 0),
        status: artist.status || 'Active',
        bio: artist.bio || '',
        followers: Number(artist.followers || 0),
        featuredTrack: artist.featuredTrack || '',
        monthlyListeners: Number(artist.monthlyListeners || 0),
        bannerUrl: artist.bannerUrl || null,
        profileUrl: artist.profileUrl || null,
      },
    });
  } catch (error) {
    console.error('Failed to load artist from PostgreSQL', error);
    return NextResponse.json({ error: 'Failed to load artist' }, { status: 500 });
  }
}
