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

export async function getArtistTotalDownloads(
  driveFileId: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();

  const result = await queryFn(
    `SELECT artists.total_downloads AS "artistDownloads"
     FROM artist_media
     INNER JOIN artists ON artists.id::text = artist_media.artist_id
     WHERE artist_media.drive_file_id = $1 AND artist_media.kind = 'track'
     LIMIT 1`,
    [driveFileId],
  );

  return Number(result.rows[0]?.artistDownloads ?? 0);
}

export async function getArtistTotalPlays(
  driveFileId: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();

  const result = await queryFn(
    `SELECT artists.total_plays AS "artistPlays"
     FROM artist_media
     INNER JOIN artists ON artists.id::text = artist_media.artist_id
     WHERE artist_media.drive_file_id = $1 AND artist_media.kind = 'track'
     LIMIT 1`,
    [driveFileId],
  );

  return Number(result.rows[0]?.artistPlays ?? 0);
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

export async function getMediaPlayCount(
  driveFileId: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();

  const result = await queryFn(
    `SELECT play_count AS "trackPlays"
     FROM artist_media
     WHERE drive_file_id = $1 AND kind = 'track'`,
    [driveFileId],
  );

  return Number(result.rows[0]?.trackPlays ?? 0);
}

export async function incrementMediaPlayCountForListen(
  driveFileId: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();

  await queryFn(
    `UPDATE artist_media
     SET play_count = COALESCE(play_count, 0) + 1
     WHERE drive_file_id = $1 AND kind = 'track'`,
    [driveFileId],
  );

  await queryFn(
    `UPDATE artists
     SET total_plays = COALESCE(total_plays, 0) + 1
     WHERE id::text = (SELECT artist_id FROM artist_media WHERE drive_file_id = $1 LIMIT 1)`,
    [driveFileId],
  );

  const result = await queryFn(
    `SELECT play_count AS "trackPlays"
     FROM artist_media
     WHERE drive_file_id = $1 AND kind = 'track'`,
    [driveFileId],
  );

  return Number(result.rows[0]?.trackPlays ?? 0);
}

export async function recordDownloadRegion(
  region: string,
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  const normalizedRegion = region.trim().slice(0, 100);
  if (!normalizedRegion) return;

  await ensureDatabaseReady();
  await queryFn(`
    CREATE TABLE IF NOT EXISTS download_regions (
      region TEXT PRIMARY KEY,
      download_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await queryFn(
    `INSERT INTO download_regions (region, download_count)
     VALUES ($1, 1)
     ON CONFLICT (region) DO UPDATE
     SET download_count = download_regions.download_count + 1, updated_at = NOW()`,
    [normalizedRegion],
  );
}

export async function getDownloadRegions(
  queryFn: MediaPlayQuery = (sql, params) => pool.query(sql, params),
) {
  await ensureDatabaseReady();
  await queryFn(`
    CREATE TABLE IF NOT EXISTS download_regions (
      region TEXT PRIMARY KEY,
      download_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const result = await queryFn(
    `SELECT region AS name, download_count AS downloads
     FROM download_regions ORDER BY download_count DESC, region ASC LIMIT 5`,
  );
  return result.rows.map((row) => ({ name: String(row.name), downloads: Number(row.downloads || 0) }));
}
