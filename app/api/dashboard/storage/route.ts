import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getConfiguredDriveStorageEntries, getTalkShowGoogleConfig, saveFileLocally, uploadToGoogleDrive } from '@/lib/google-drive';
import { recordActivity } from '@/lib/activity';
import { getInMemoryStorageItems, inMemoryStorageItems, pushInMemoryStorageItem } from '@/lib/storage-items';
import { getDatabaseConnectionString } from '@/lib/db';

export const runtime = 'nodejs';

const connectionString = getDatabaseConnectionString();

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
        source TEXT NOT NULL DEFAULT 'talk-show',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE storage_items
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'talk-show'
    `);
  } finally {
    client.release();
  }
}

export async function GET(request: Request) {
  let driveStorage = null;
  let driveStorageError = '';
  let driveStorageEntries: Array<{ label: string; used: number; limit: number | null; usedInDrive: number; usedInTrash: number; error?: string }> = [];

  try {
    const configuredEntries = await getConfiguredDriveStorageEntries();
    driveStorageEntries = configuredEntries.map((entry) => ({
      label: entry.label,
      used: entry.storage?.used ?? 0,
      limit: entry.storage?.limit ?? null,
      usedInDrive: entry.storage?.usedInDrive ?? 0,
      usedInTrash: entry.storage?.usedInTrash ?? 0,
      error: entry.error,
    }));

    const firstConfiguredEntry = driveStorageEntries.find((entry) => !entry.error && entry.used > 0) ?? driveStorageEntries[0];
    if (firstConfiguredEntry) {
      driveStorage = {
        used: firstConfiguredEntry.used,
        limit: firstConfiguredEntry.limit,
        usedInDrive: firstConfiguredEntry.usedInDrive,
        usedInTrash: firstConfiguredEntry.usedInTrash,
      };
    }
  } catch (error) {
    driveStorageError = (error as Error).message;
  }

  const url = new URL(request.url);
  const sourceFilter = url.searchParams.get('source')?.trim().toLowerCase();
  const isTalkShowFilter = sourceFilter === 'talk-show';
  const isPrimaryFilter = sourceFilter === 'primary';

  if (!pool) {
    return NextResponse.json({
      items: getInMemoryStorageItems().slice().reverse(),
      driveStorage,
      driveStorageError,
      driveStorageEntries,
    });
  }

  try {
    await ensureStorageTable();

    let queryText = `
      SELECT id, title, type, file_url AS "fileUrl", source, created_at AS "createdAt"
      FROM storage_items`;
    const queryParams: string[] = [];

    if (isTalkShowFilter || isPrimaryFilter) {
      queryText += `\n      WHERE source = $1`;
      queryParams.push(isTalkShowFilter ? 'talk-show' : 'primary');
    }

    queryText += `\n      ORDER BY created_at DESC`;
    const { rows } = await pool.query(queryText, queryParams);

    return NextResponse.json({
        items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        file_url: row.fileUrl,
          source: row.source,
        created_at: row.createdAt,
      })),
      driveStorage,
      driveStorageError,
      driveStorageEntries,
    });
  } catch (error) {
    console.warn('Falling back to the in-memory storage list because PostgreSQL is unavailable', error);
    return NextResponse.json({ items: getInMemoryStorageItems().slice().reverse(), driveStorage, driveStorageError, driveStorageEntries });
  }
}

export async function POST(request: Request) {
  const isMultipart = request.headers.get('content-type')?.includes('multipart/form-data');

  let title = '';
  let type = 'music';
  let fileUrl = '';
  let uploadedFile: File | null = null;
  let source = 'talk-show';

  if (isMultipart) {
    const formData = await request.formData();
    const titleCandidate = formData.get('title');
    title = typeof titleCandidate === 'string' ? titleCandidate.trim() : '';
    const typeCandidate = formData.get('type');
    type = typeof typeCandidate === 'string' ? typeCandidate : 'music';
    const fileUrlCandidate = formData.get('fileUrl');
    fileUrl = typeof fileUrlCandidate === 'string' ? fileUrlCandidate : '';
    const sourceCandidate = formData.get('source');
    const normalizedSource = typeof sourceCandidate === 'string' ? sourceCandidate.trim().toLowerCase() : '';
    if (normalizedSource === 'primary' || normalizedSource === 'talk-show') {
      source = normalizedSource;
    }
    const fileCandidate = formData.get('file');
    uploadedFile = fileCandidate instanceof File ? fileCandidate : null;
  } else {
    const body = await request.json().catch(() => ({}));
    title = typeof body?.title === 'string' ? body.title.trim() : '';
    type = typeof body?.type === 'string' ? body.type : 'music';
    fileUrl = typeof body?.fileUrl === 'string' ? body.fileUrl : '';
    const sourceCandidate = typeof body?.source === 'string' ? body.source.trim().toLowerCase() : '';
    if (sourceCandidate === 'primary' || sourceCandidate === 'talk-show') {
      source = sourceCandidate;
    }
  }

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  let publicUrl = fileUrl;
  let uploadError: string | null = null;

  if (uploadedFile) {
    try {
      const driveFile = await uploadToGoogleDrive(
        {
          name: uploadedFile.name,
          mimeType: uploadedFile.type || 'application/octet-stream',
          bytes: await uploadedFile.arrayBuffer(),
        },
        getTalkShowGoogleConfig()
      );

      publicUrl = driveFile.publicUrl;
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error);
      console.warn('Talk Show Drive upload failed, falling back to local storage', uploadError);
      const localFile = await saveFileLocally({
        name: uploadedFile.name,
        mimeType: uploadedFile.type || 'application/octet-stream',
        bytes: await uploadedFile.arrayBuffer(),
      });
      publicUrl = localFile.publicUrl;
    }
  }

  if (!publicUrl) {
    return NextResponse.json({ error: 'File URL or uploaded file is required' }, { status: 400 });
  }

  const item = {
    id: `storage-local-${Date.now()}`,
    title,
    type,
    file_url: publicUrl,
    created_at: new Date().toISOString(),
  };

  if (!pool) {
    const persistedItem = {
      id: item.id,
      title: item.title,
      type: item.type,
      fileUrl: item.file_url,
      source,
      createdAt: item.created_at,
    };
    pushInMemoryStorageItem(persistedItem);
    return NextResponse.json({ item: persistedItem, uploadError });
  }

  try {
    await ensureStorageTable();

    const id = `storage-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await pool.query(
      `
        INSERT INTO storage_items (id, title, type, file_url, source)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, type, file_url AS "fileUrl", source, created_at AS "createdAt"
      `,
      [id, title, type, publicUrl, source]
    );

    const row = result.rows[0];
    await recordActivity({
      action: 'created',
      entityType: 'storage_item',
      entityId: row.id,
      description: `Added storage record ${row.title}`,
    });

    return NextResponse.json({
      item: {
        id: row.id,
        title: row.title,
        type: row.type,
        file_url: row.fileUrl,
        source: row.source,
        created_at: row.createdAt,
      },
      uploadError,
    });
  } catch (error) {
    console.warn('Falling back to a local storage response because PostgreSQL is unavailable', error);
    const persistedItem = {
      id: item.id,
      title: item.title,
      type: item.type,
      fileUrl: item.file_url,
      source,
      createdAt: item.created_at,
    };
    pushInMemoryStorageItem(persistedItem);
    return NextResponse.json({ item: persistedItem, uploadError });
  }
}
