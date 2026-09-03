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
        drive_file_id TEXT,
        source TEXT NOT NULL DEFAULT 'talk-show',
        thumbnail_url TEXT,
        thumbnail_drive_file_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'talk-show'`);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS drive_file_id TEXT`);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT`);
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
  let thumbnailDriveFileId: string | null = null;
  if (thumbnail instanceof File) {
    if (!thumbnail.type.startsWith('image/')) return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 });
    try {
      const driveFile = await uploadToGoogleDrive({ name: `thumbnail-${Date.now()}-${thumbnail.name}`, mimeType: thumbnail.type, bytes: await thumbnail.arrayBuffer() }, getTalkShowGoogleConfig());
      thumbnailUrl = driveFile.publicUrl;
      thumbnailDriveFileId = driveFile.id;
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
    const previousResult = thumbnail instanceof File
      ? await pool.query(
        `SELECT thumbnail_url AS "thumbnailUrl", thumbnail_drive_file_id AS "thumbnailDriveFileId"
         FROM storage_items WHERE id = $1`,
        [id]
      )
      : { rows: [] };
    const { rows } = await pool.query(
      `UPDATE storage_items SET title = COALESCE(NULLIF($1, ''), title), thumbnail_url = COALESCE($2, thumbnail_url), thumbnail_drive_file_id = COALESCE($3, thumbnail_drive_file_id) WHERE id = $4 RETURNING id, title, type, file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", source, created_at AS "createdAt"`,
      [title, thumbnailUrl || null, thumbnailDriveFileId, id]
    );

    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (thumbnail instanceof File && previousResult.rows[0]) {
      const previousThumbnailUrl = previousResult.rows[0].thumbnailUrl as string | null;
      const previousThumbnailDriveId = previousResult.rows[0].thumbnailDriveFileId as string | null;
      try {
        if (previousThumbnailDriveId) {
          await deleteFromGoogleDrive(previousThumbnailDriveId, getTalkShowGoogleConfig());
        }
        if (previousThumbnailUrl?.startsWith('/api/uploads/')) {
          const fileName = previousThumbnailUrl.replace(/^\/api\/uploads\//, '');
          const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
          const uploadsDir = configured || path.join(os.tmpdir(), 'nsu-uploads');
          await fs.unlink(path.join(uploadsDir, fileName)).catch(() => {});
        }
      } catch (error) {
        console.warn('Unable to remove the previous storage thumbnail', error);
      }
    }

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
    const { rows } = await pool.query(
      `SELECT id, file_url AS "fileUrl", drive_file_id AS "driveFileId", thumbnail_url AS "thumbnailUrl", thumbnail_drive_file_id AS "thumbnailDriveFileId"
       FROM storage_items WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fileUrl: string = rows[0].fileUrl || '';
    const driveFileIds = new Set<string>();
    if (rows[0].driveFileId) driveFileIds.add(rows[0].driveFileId);
    if (rows[0].thumbnailDriveFileId) driveFileIds.add(rows[0].thumbnailDriveFileId);

    const mainDriveId = fileUrl.match(/\/api\/dashboard\/media\/([^/?]+)/)?.[1];
    if (mainDriveId) driveFileIds.add(mainDriveId);
    const thumbnailUrl: string = rows[0].thumbnailUrl || '';
    const thumbnailDriveId = thumbnailUrl.match(/[?&]id=([^&]+)/)?.[1];
    if (thumbnailDriveId) driveFileIds.add(thumbnailDriveId);

    try {
      await Promise.all([...driveFileIds].map((fileId) => deleteFromGoogleDrive(fileId, getTalkShowGoogleConfig())));

      if (fileUrl.startsWith('/api/uploads/')) {
        const fileName = fileUrl.replace(/^\/api\/uploads\//, '');
        const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
        const uploadsDir = configured || path.join(os.tmpdir(), 'nsu-uploads');
        const filePath = path.join(uploadsDir, fileName);
        await fs.unlink(filePath).catch(() => {});
      }

      if (thumbnailUrl.startsWith('/api/uploads/')) {
        const fileName = thumbnailUrl.replace(/^\/api\/uploads\//, '');
        const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
        const uploadsDir = configured || path.join(os.tmpdir(), 'nsu-uploads');
        await fs.unlink(path.join(uploadsDir, fileName)).catch(() => {});
      }
    } catch (err) {
      console.warn('Unable to remove one or more storage files before deleting the database row', err);
    }

    await pool.query(`DELETE FROM storage_items WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
