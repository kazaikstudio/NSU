import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { deleteFromGoogleDrive, getTalkShowGoogleConfig, saveFileLocally, uploadToGoogleDrive } from '@/lib/google-drive';
import { deleteInMemoryStorageItem, updateInMemoryStorageItemTitle } from '@/lib/storage-items';
import { getDatabaseConnectionString } from '@/lib/db';

export const runtime = 'nodejs';

const connectionString = getDatabaseConnectionString();
let pool: Pool | null = null;
if (connectionString) pool = new Pool({ connectionString });

async function ensureStorageTable() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS storage_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'talk-show',
        thumbnail_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'talk-show'`);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`);
  } finally {
    client.release();
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');
  const body = isMultipart ? await request.formData() : await request.json().catch(() => ({}));
  const title = isMultipart
    ? (body.get('title') as string | null)?.trim() || ''
    : typeof body?.title === 'string' ? body.title.trim() : '';
  const thumbnail = isMultipart ? body.get('thumbnail') : null;
  if (!title && !(thumbnail instanceof File)) return NextResponse.json({ error: 'Title or thumbnail is required' }, { status: 400 });

  let thumbnailUrl: string | undefined;
  if (thumbnail instanceof File) {
    if (!thumbnail.type.startsWith('image/')) return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 });
    try {
      const driveFile = await uploadToGoogleDrive({ name: `thumbnail-${Date.now()}-${thumbnail.name}`, mimeType: thumbnail.type, bytes: await thumbnail.arrayBuffer() }, getTalkShowGoogleConfig());
      thumbnailUrl = driveFile.publicUrl;
    } catch {
      const localFile = await saveFileLocally({ name: thumbnail.name, mimeType: thumbnail.type, bytes: await thumbnail.arrayBuffer() });
      thumbnailUrl = localFile.publicUrl;
    }
  }

  if (!pool) {
    const updatedItem = updateInMemoryStorageItemTitle(id, title);
    if (!updatedItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ item: { id: updatedItem.id, title: updatedItem.title, type: updatedItem.type, file_url: updatedItem.file_url || updatedItem.fileUrl || '', thumbnail_url: thumbnailUrl || updatedItem.thumbnail_url, created_at: updatedItem.created_at || updatedItem.createdAt || new Date().toISOString() } });
  }

  try {
    await ensureStorageTable();
    const { rows } = await pool.query(
      `UPDATE storage_items SET title = COALESCE(NULLIF($1, ''), title), thumbnail_url = COALESCE($2, thumbnail_url) WHERE id = $3 RETURNING id, title, type, file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", source, created_at AS "createdAt"`,
      [title, thumbnailUrl || null, id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const row = rows[0];
    return NextResponse.json({
      item: {
        id: row.id,
        title: row.title,
        type: row.type,
        file_url: row.fileUrl,
        thumbnail_url: row.thumbnailUrl,
        source: row.source,
        created_at: row.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (!pool) {
    const removedItem = deleteInMemoryStorageItem(id);
    if (!removedItem) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  try {
    await ensureStorageTable();
    const { rows } = await pool.query(`SELECT id, file_url AS "fileUrl" FROM storage_items WHERE id = $1`, [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fileUrl: string = rows[0].fileUrl || '';

    try {
      if (fileUrl.startsWith('/api/dashboard/media/')) {
        const parts = fileUrl.split('/');
        const fileId = parts[parts.length - 1];
        if (fileId) await deleteFromGoogleDrive(fileId);
      } else if (fileUrl.startsWith('/api/uploads/')) {
        const fileName = fileUrl.replace(/^\/api\/uploads\//, '');
        const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
        const uploadsDir = configured || path.join(os.tmpdir(), 'nsu-uploads');
        const filePath = path.join(uploadsDir, fileName);
        await fs.unlink(filePath).catch(() => {});
      }
    } catch (err) {
      // ignore individual delete errors
    }

    await pool.query(`DELETE FROM storage_items WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
