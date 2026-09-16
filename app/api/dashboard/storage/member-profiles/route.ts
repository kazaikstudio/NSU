import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import path from 'path';
import { promises as fs } from 'fs';
import { deleteStoredObject } from '@/lib/railway-storage';
import { getLocalUploadsDir } from '@/lib/local-storage';
import { getDatabaseConnectionString } from '@/lib/db';

export const runtime = 'nodejs';

const connectionString = getDatabaseConnectionString();
const pool = connectionString ? new Pool({ connectionString }) : null;

export async function DELETE() {
  if (!pool) {
    return NextResponse.json({ removed: 0 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, file_url AS "fileUrl", drive_file_id AS "driveFileId"
       FROM storage_items
       WHERE source = 'talk-show' AND title LIKE 'Member profile - %'`,
    );

    const driveFileIds = rows
      .flatMap((row) => [row.driveFileId, row.fileUrl?.match(/\/api\/dashboard\/media\/([^/?]+)/)?.[1]])
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    await Promise.all(driveFileIds.map(async (id) => {
      try {
        await deleteStoredObject(id);
      } catch (error) {
        console.warn('Unable to remove legacy member profile from storage', error);
      }
    }));

    const uploadsDir = getLocalUploadsDir();
    await Promise.all(rows
      .map((row) => row.fileUrl as string | undefined)
      .filter((url): url is string => Boolean(url?.startsWith('/api/uploads/')))
      .map((url) => fs.unlink(path.join(uploadsDir, url.replace(/^\/api\/uploads\//, ''))).catch(() => {})));

    const result = await pool.query(
      `DELETE FROM storage_items
       WHERE source = 'talk-show' AND title LIKE 'Member profile - %'`,
    );

    return NextResponse.json({ removed: result.rowCount || 0 });
  } catch (error) {
    console.error('Unable to remove legacy member profile storage records', error);
    return NextResponse.json({ error: 'Unable to remove legacy member profile storage records' }, { status: 500 });
  }
}
