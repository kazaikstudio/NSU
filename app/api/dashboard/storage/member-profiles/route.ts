import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { deleteFromGoogleDrive, getTalkShowGoogleConfig } from '@/lib/google-drive';
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

    await Promise.all(driveFileIds.map((id) => deleteFromGoogleDrive(id, getTalkShowGoogleConfig()).catch((error) => {
      console.warn('Unable to remove legacy member profile from Talk Show Drive', error);
    })));

    const configured = process.env.LOCAL_UPLOAD_DIR && process.env.LOCAL_UPLOAD_DIR.trim();
    const uploadsDir = configured || path.join(os.tmpdir(), 'nsu-uploads');
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
