import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getGoogleDriveStorageUsage } from '@/lib/google-drive';
import { recordActivity } from '@/lib/activity';

export const runtime = 'nodejs';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEXT_PUBLIC_DATABASE_URL;

let pool: Pool | null = null;

if (connectionString) {
  pool = new Pool({ connectionString });
}

async function ensureStorageTable() {
  if (!pool) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS storage_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } finally {
    client.release();
  }
}

export async function GET() {
  let driveStorage = null;
  let driveStorageError = '';
  try {
    driveStorage = await getGoogleDriveStorageUsage();
  } catch (error) {
    driveStorageError = (error as Error).message;
  }

  if (!pool) {
    return NextResponse.json({ items: [], driveStorage, driveStorageError });
  }

  try {
    await ensureStorageTable();

    const { rows } = await pool.query(`
      SELECT id, title, type, file_url AS "fileUrl", created_at AS "createdAt"
      FROM storage_items
      ORDER BY created_at DESC
    `);

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        file_url: row.fileUrl,
        created_at: row.createdAt,
      })),
      driveStorage,
      driveStorageError,
    });
  } catch (error) {
    console.warn('Falling back to an empty storage list because PostgreSQL is unavailable', error);
    return NextResponse.json({ items: [], driveStorage, driveStorageError });
  }
}

export async function POST(request: Request) {
  if (!pool) {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const type = typeof body?.type === 'string' ? body.type : 'music';
    const fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl : '';

    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'Title and file URL are required' });
    }

    return NextResponse.json({
      item: {
        id: `storage-local-${Date.now()}`,
        title,
        type,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
      },
    });
  }

  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const type = typeof body?.type === 'string' ? body.type : 'music';
    const fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl : '';

    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'Title and file URL are required' }, { status: 400 });
    }

    await ensureStorageTable();

    const id = `storage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await pool.query(
      `
        INSERT INTO storage_items (id, title, type, file_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, title, type, file_url AS "fileUrl", created_at AS "createdAt"
      `,
      [id, title, type, fileUrl]
    );

    const item = result.rows[0];
    await recordActivity({
      action: 'created',
      entityType: 'storage_item',
      entityId: item.id,
      description: `Added storage record ${item.title}`,
    });

    return NextResponse.json({
      item: {
        id: item.id,
        title: item.title,
        type: item.type,
        file_url: item.fileUrl,
        created_at: item.createdAt,
      },
    });
  } catch (error) {
    console.warn('Falling back to a local storage response because PostgreSQL is unavailable', error);
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const type = typeof body?.type === 'string' ? body.type : 'music';
    const fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl : '';

    if (!title || !fileUrl) {
      return NextResponse.json({ error: 'Title and file URL are required' });
    }

    return NextResponse.json({
      item: {
        id: `storage-local-${Date.now()}`,
        title,
        type,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
      },
    });
  }
}
