import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { saveFileLocally } from '@/lib/local-storage';
import { getConfiguredStorageEntries, uploadToBucket } from '@/lib/railway-storage';
import { recordActivity } from '@/lib/activity';
import { getInMemoryStorageItems, pushInMemoryStorageItem } from '@/lib/storage-items';
import { getDatabaseConnectionString } from '@/lib/db';
import { shouldTranscodeVideo, transcodeVideoToStreamable } from '@/lib/video-transcode';

export const runtime = 'nodejs';
export const maxDuration = 300;

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
        drive_file_id TEXT,
        thumbnail_url TEXT,
        thumbnail_drive_file_id TEXT,
        source TEXT NOT NULL DEFAULT 'talk-show',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE storage_items
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'talk-show'
    `);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS drive_file_id TEXT`);
    await client.query(`ALTER TABLE storage_items ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT`);
  } finally {
    client.release();
  }
}

export async function GET(request: Request) {
  let driveStorage = null;
  let driveStorageError = '';
  let driveStorageEntries: Array<{ label: string; used: number; limit: number | null; usedInDrive: number; usedInTrash: number; error?: string }> = [];

  try {
    driveStorageEntries = await getConfiguredStorageEntries();

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

  // Pagination caps on the public lists (home feed, Comedy row) so the browser
  // never downloads the entire table just to render a row of 5 cards.
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
      SELECT id, title, type, file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", source, created_at AS "createdAt"
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
        thumbnail_url: row.thumbnailUrl,
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
  let uploadedThumbnail: File | null = null;
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
    const thumbnailCandidate = formData.get('thumbnail');
    uploadedThumbnail = thumbnailCandidate instanceof File ? thumbnailCandidate : null;
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
  let uploadedDriveFileId: string | null = null;
  let thumbnailUrl: string | null = null;
  let thumbnailDriveFileId: string | null = null;
  let uploadError: string | null = null;

  if (uploadedFile) {
    const originalBytes = await uploadedFile.arrayBuffer();
    let storageName = title || uploadedFile.name;
    let mimeType = uploadedFile.type || 'application/octet-stream';
    let bytesToStore: ArrayBuffer = originalBytes;

    if (shouldTranscodeVideo(uploadedFile.name, uploadedFile.type, originalBytes.byteLength)) {
      const transcodedVideo = await transcodeVideoToStreamable(originalBytes, storageName);
      if (transcodedVideo) {
        storageName = transcodedVideo.name;
        mimeType = transcodedVideo.mimeType;
        bytesToStore = transcodedVideo.bytes.slice().buffer as ArrayBuffer;
      }
    }

    try {
      const storageFile = await uploadToBucket({
        name: storageName,
        mimeType,
        bytes: bytesToStore,
      });

      publicUrl = storageFile.publicUrl;
      uploadedDriveFileId = storageFile.id;
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error);
      console.warn('Bucket upload failed, falling back to local storage', uploadError);
      const localFile = await saveFileLocally({
        name: storageName,
        mimeType,
        bytes: bytesToStore,
      });
      publicUrl = localFile.publicUrl;
    }
  }

  if (uploadedThumbnail) {
    try {
      if (!uploadedThumbnail.type.startsWith('image/')) {
        throw new Error('Generated thumbnail is not a valid image.');
      }
      const storageFile = await uploadToBucket({
        name: `video-thumbnail-${Date.now()}-${uploadedThumbnail.name}`,
        mimeType: uploadedThumbnail.type,
        bytes: await uploadedThumbnail.arrayBuffer(),
      });
      thumbnailUrl = storageFile.publicUrl;
      thumbnailDriveFileId = storageFile.id;
    } catch (error) {
      console.warn('Unable to upload generated video thumbnail', error);
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
        INSERT INTO storage_items (id, title, type, file_url, drive_file_id, source, thumbnail_url, thumbnail_drive_file_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, title, type, file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl", source, created_at AS "createdAt"
      `,
      [id, title, type, publicUrl, uploadedDriveFileId, source, thumbnailUrl, thumbnailDriveFileId]
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
        thumbnail_url: row.thumbnailUrl,
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
