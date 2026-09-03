import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export const runtime = 'nodejs';

type Context = { params: Promise<{ id: string }> };

function getSubscriberId(request: Request) {
  const subscriberId = request.headers.get('x-subscriber-id') || '';
  return /^[a-zA-Z0-9_-]{16,128}$/.test(subscriberId) ? subscriberId : null;
}

async function ensureFollowTable() {
  await ensureDatabaseReady();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_follows (
      artist_id TEXT NOT NULL,
      subscriber_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (artist_id, subscriber_id)
    )
  `);
}

async function getFollowState(artistId: string, subscriberId: string) {
  const result = await pool.query<{ following: boolean; followerCount: string }>(
    `SELECT EXISTS(
       SELECT 1 FROM artist_follows WHERE artist_id = $1 AND subscriber_id = $2
     ) AS following,
     COUNT(*)::text AS "followerCount"
     FROM artist_follows WHERE artist_id = $1`,
    [artistId, subscriberId]
  );

  const followerCount = Number(result.rows[0]?.followerCount || 0);
  await pool.query(
    'UPDATE artists SET followers = $1 WHERE id::text = $2',
    [followerCount, artistId]
  );

  return { following: result.rows[0]?.following === true, followerCount };
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const subscriberId = getSubscriberId(request);
  if (!id || !subscriberId) {
    return NextResponse.json({ error: 'A valid subscriber id is required' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getFollowState(id, subscriberId));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const subscriberId = getSubscriberId(request);
  if (!id || !subscriberId) {
    return NextResponse.json({ error: 'A valid subscriber id is required' }, { status: 400 });
  }

  try {
    await ensureFollowTable();
    await pool.query(
      'INSERT INTO artist_follows (artist_id, subscriber_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, subscriberId]
    );
    return NextResponse.json(await getFollowState(id, subscriberId));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const { id } = await context.params;
  const subscriberId = getSubscriberId(request);
  if (!id || !subscriberId) {
    return NextResponse.json({ error: 'A valid subscriber id is required' }, { status: 400 });
  }

  try {
    await ensureFollowTable();
    await pool.query(
      'DELETE FROM artist_follows WHERE artist_id = $1 AND subscriber_id = $2',
      [id, subscriberId]
    );
    return NextResponse.json(await getFollowState(id, subscriberId));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
