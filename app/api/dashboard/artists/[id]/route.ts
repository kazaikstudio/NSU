import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { artistsSeed } from '@/lib/artists';
import { deleteFromGoogleDrive } from '@/lib/google-drive';
import { recordActivity } from '@/lib/activity';
import { getDatabaseConnectionString } from '@/lib/db';

export const runtime = 'nodejs';

const connectionString = getDatabaseConnectionString();

let pool: Pool | null = null;
let artistsTableReady = false;
let artistsTableSetup: Promise<void> | null = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: /railway|rlwy/i.test(connectionString) ? { rejectUnauthorized: false } : false,
  });
}

async function ensureArtistsTable() {
  if (!pool) {
    return;
  }

  if (artistsTableReady) return;

  if (artistsTableSetup) {
    await artistsTableSetup;
    return;
  }

  artistsTableSetup = (async () => {
    const client = await pool!.connect();

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
        ADD COLUMN IF NOT EXISTS total_downloads INTEGER NOT NULL DEFAULT 0,
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

    artistsTableReady = true;
  })();

  try {
    await artistsTableSetup;
  } finally {
    artistsTableSetup = null;
  }
}

async function ensureArtistMediaTable() {
  if (!pool) return;

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!pool) {
    const fallbackArtist = artistsSeed.find((artist) => artist.id === id);
    return NextResponse.json({ artist: fallbackArtist ? {
      id: fallbackArtist.id,
      name: fallbackArtist.name,
      genre: fallbackArtist.genre,
      tracksCount: fallbackArtist.tracksCount,
      status: fallbackArtist.status,
      bio: fallbackArtist.bio,
      followers: fallbackArtist.followers,
      totalDownloads: 0,
      featuredTrack: fallbackArtist.featuredTrack,
      monthlyListeners: fallbackArtist.monthlyListeners,
      bannerUrl: fallbackArtist.bannerUrl || null,
      profileUrl: fallbackArtist.profileUrl || null,
    } : null });
  }

  try {

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
          total_downloads AS "totalDownloads",
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
        totalDownloads: Number(artist.totalDownloads || 0),
        featuredTrack: artist.featuredTrack || '',
        monthlyListeners: Number(artist.monthlyListeners || 0),
        bannerUrl: artist.bannerUrl || null,
        profileUrl: artist.profileUrl || null,
      },
    });
  } catch (error) {
    console.warn('Falling back to the seeded artist because PostgreSQL is unavailable', error);
    const fallbackArtist = artistsSeed.find((artist) => artist.id === id);
    return NextResponse.json({ artist: fallbackArtist ? {
      id: fallbackArtist.id,
      name: fallbackArtist.name,
      genre: fallbackArtist.genre,
      tracksCount: fallbackArtist.tracksCount,
      status: fallbackArtist.status,
      bio: fallbackArtist.bio,
      followers: fallbackArtist.followers,
      totalDownloads: 0,
      featuredTrack: fallbackArtist.featuredTrack,
      monthlyListeners: fallbackArtist.monthlyListeners,
      bannerUrl: fallbackArtist.bannerUrl || null,
      profileUrl: fallbackArtist.profileUrl || null,
    } : null });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!pool) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const genre = typeof body?.genre === 'string' ? body.genre.trim() : '';

    if (!name || !genre) {
      return NextResponse.json({ error: 'Artist name and genre are required' }, { status: 400 });
    }

    await ensureArtistsTable();
    const { rows } = await pool.query(
      `UPDATE artists
       SET name = $1, genre = $2, updated_at = NOW()
       WHERE id::text = $3
       RETURNING id, name, genre, tracks_count AS "tracksCount", status, bio, followers, total_downloads AS "totalDownloads", featured_track AS "featuredTrack", monthly_listeners AS "monthlyListeners", banner_url AS "bannerUrl", profile_url AS "profileUrl"`,
      [name, genre, id]
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
        totalDownloads: Number(artist.totalDownloads || 0),
        featuredTrack: artist.featuredTrack || '',
        monthlyListeners: Number(artist.monthlyListeners || 0),
        bannerUrl: artist.bannerUrl || null,
        profileUrl: artist.profileUrl || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!pool) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 500 });
  }

  try {
    await ensureArtistsTable();
    await ensureArtistMediaTable();
    const mediaResult = await pool.query<{ driveFileId: string | null }>(
      'SELECT drive_file_id AS "driveFileId" FROM artist_media WHERE artist_id::text = $1',
      [id]
    );
    const result = await pool.query('DELETE FROM artists WHERE id::text = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    await pool.query('DELETE FROM artist_media WHERE artist_id::text = $1', [id]);
    const driveDeletes = await Promise.allSettled(
      mediaResult.rows
        .map((media) => media.driveFileId)
        .filter((fileId): fileId is string => Boolean(fileId))
        .map((fileId) => deleteFromGoogleDrive(fileId))
    );
    const failedDriveDeletes = driveDeletes.filter((result) => result.status === 'rejected').length;
    await recordActivity({
      action: 'deleted',
      entityType: 'artist',
      entityId: id,
      description: `Deleted artist ${id} and all related media${failedDriveDeletes ? ` (${failedDriveDeletes} Drive files could not be deleted)` : ''}`,
    });

    return NextResponse.json({ success: true, failedDriveDeletes });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
