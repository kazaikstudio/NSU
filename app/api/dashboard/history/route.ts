import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

export const runtime = 'nodejs';

async function ensureActivityTable() {
  await ensureDatabaseReady();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_meta (
      id INTEGER PRIMARY KEY,
      initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: markerRows } = await pool.query('SELECT id FROM activity_meta WHERE id = 1');
  if (markerRows.length > 0) return;

  const { rows: countRows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM activity_logs');
  if (Number(countRows[0]?.count || 0) > 0) {
    await pool.query('INSERT INTO activity_meta (id) VALUES (1) ON CONFLICT DO NOTHING');
    return;
  }

  await pool.query(`
    INSERT INTO activity_logs (action, entity_type, entity_id, description, created_at)
    SELECT 'created', 'artist', id::text, 'Artist record currently exists: ' || name, COALESCE(created_at, NOW())
    FROM artists
  `);

  try {
    await pool.query(`
      INSERT INTO activity_logs (action, entity_type, entity_id, description, created_at)
      SELECT CASE WHEN kind = 'track' THEN 'uploaded' ELSE 'created' END,
             CASE WHEN kind = 'track' THEN 'track' ELSE 'artist_media' END,
             id, 'Existing ' || kind || ' file: ' || file_name, created_at
      FROM artist_media
    `);
  } catch {
    // The media table is created lazily by the media route.
  }

  await pool.query(`
    INSERT INTO activity_logs (action, entity_type, entity_id, description, created_at)
    SELECT 'created', 'member', id::text, 'Member record currently exists: ' || name, COALESCE(created_at, NOW())
    FROM members
  `);

  try {
    await pool.query(`
      INSERT INTO activity_logs (action, entity_type, entity_id, description, created_at)
      SELECT 'created', 'storage_item', id, 'Existing storage record: ' || title, created_at
      FROM storage_items
    `);
  } catch {
    // The storage table is optional in deployments without legacy storage records.
  }

  await pool.query('INSERT INTO activity_meta (id) VALUES (1) ON CONFLICT DO NOTHING');
}

export async function GET() {
  try {
    await ensureActivityTable();
    const { rows } = await pool.query(`
      SELECT id, action, entity_type AS "entityType", entity_id AS "entityId",
             description, created_at AS "createdAt"
      FROM activity_logs
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `);
    return NextResponse.json({ history: rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureActivityTable();
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const result = await pool.query('DELETE FROM activity_logs WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return NextResponse.json({ error: 'History entry not found' }, { status: 404 });
      }
    } else {
      await pool.query('TRUNCATE TABLE activity_logs RESTART IDENTITY');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
