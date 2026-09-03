import pool, { ensureDatabaseReady } from '@/lib/db';

export type MediaPlayQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;

export async function getMediaDownloadCount(
  driveFileId: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();

  const result = await queryFn(
    `SELECT download_count AS "trackDownloads"
     FROM artist_media
     WHERE drive_file_id = $1 AND kind = 'track'`,
    [driveFileId],
  );

  return Number(result.rows[0]?.trackDownloads ?? 0);
}

export async function incrementMediaPlayCount(
  driveFileId: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();

  await queryFn(
    `UPDATE artist_media
     SET download_count = COALESCE(download_count, 0) + 1
     WHERE drive_file_id = $1 AND kind = 'track'`,
    [driveFileId],
  );

  await queryFn(
    `UPDATE artists
     SET total_downloads = COALESCE(total_downloads, 0) + 1
     WHERE id::text = (SELECT artist_id FROM artist_media WHERE drive_file_id = $1 LIMIT 1)`,
    [driveFileId],
  );

  const result = await queryFn(
    `SELECT download_count AS "trackDownloads"
     FROM artist_media
     WHERE drive_file_id = $1 AND kind = 'track'`,
    [driveFileId],
  );

  const nextValue = Number(result.rows[0]?.trackDownloads ?? 0);
  return nextValue;
}
