// lib/db.ts
import { Pool, PoolClient } from 'pg';

type DatabasePool = Pick<Pool, 'query' | 'connect' | 'end'>;

export function resolveDatabaseConnectionString(env: NodeJS.ProcessEnv = process.env) {
  const isPrivateRailwayHostname = (value: string) => {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname.endsWith('.railway.internal') || hostname === 'railway.internal';
    } catch {
      return false;
    }
  };

  const candidateUrls = [
    env.DATABASE_URL,
    env.POSTGRES_URL,
    env.DATABASE_PUBLIC_URL,
    env.NEXT_PUBLIC_DATABASE_URL,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  const validDirectUrl = candidateUrls.find((value) => {
    const lower = value.toLowerCase();
    return !isPrivateRailwayHostname(value)
      && !/USER:PASSWORD|USERNAME:PASSWORD|user:password|username:password|your_railway_postgres_url|replace_with|example\.com|<username>|<password>/i.test(value)
      && !/\/\$\{.*\}/.test(value)
      && !lower.includes('placeholder');
  });

  if (validDirectUrl) {
    return validDirectUrl;
  }

  const host = env.PGHOST || env.POSTGRES_HOST;
  const port = env.PGPORT || env.POSTGRES_PORT || '5432';
  const database = env.PGDATABASE || env.POSTGRES_DB || env.POSTGRES_DATABASE;
  const user = env.PGUSER || env.POSTGRES_USER;
  const password = env.PGPASSWORD || env.POSTGRES_PASSWORD;

  if (host && database && user) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password || '')}@${host}:${port}/${database}`;
  }

  return undefined;
}

export function getDatabaseConnectionString(env: NodeJS.ProcessEnv = process.env) {
  return resolveDatabaseConnectionString(env) ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? undefined;
}

const connectionString = getDatabaseConnectionString();
const hasConfiguredDatabase = Boolean(connectionString);

export function buildDatabasePoolConfig({
  connectionString,
  isProduction = process.env.NODE_ENV === 'production',
}: {
  connectionString?: string;
  isProduction?: boolean;
}) {
  const timeoutMs = Number(process.env.DATABASE_TIMEOUT_MS || 10000);

  return {
    connectionString,
    ssl: connectionString && /railway|rlwy/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : isProduction
        ? { rejectUnauthorized: false }
        : false,
    connectionTimeoutMillis: timeoutMs,
    idleTimeoutMillis: timeoutMs,
    max: 2,
  };
}

const pool = hasConfiguredDatabase
  ? new Pool(buildDatabasePoolConfig({ connectionString }))
  : null;

// A pg pool emits 'error' when an idle client dies (e.g. the database
// restarts or the network drops). Without a listener that event is an
// uncaught exception and takes the whole process down; instead, mark the pool
// unavailable so the next request transparently reconnects.
pool?.on('error', (err) => {
  console.warn('Idle database client error; marking pool unavailable for reconnection.', err);
  databaseAvailable = false;
});

let databaseAvailable = Boolean(pool);

const createNoopPool = (): DatabasePool => ({
  async query() {
    throw new Error('Database is not configured');
  },
  async connect() {
    throw new Error('Database is not configured');
  },
  async end() {},
});

const noopPool = createNoopPool();

const connectWithTimeout = async (connectFn: () => Promise<PoolClient>) => {
  const timeoutMs = Number(process.env.DATABASE_TIMEOUT_MS || 10000);
  return Promise.race([
    connectFn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timed out')), timeoutMs);
    }),
  ]);
};

let recoveryPromise: Promise<boolean> | null = null;

// Lazy reconnect: when a query arrives and the pool is currently marked
// unavailable, try to (re)establish the connection instead of permanently
// rejecting every request for the lifetime of the process. Only one attempt
// runs at a time; concurrent callers share the same attempt.
function recoverDatabase(): Promise<boolean> {
  if (!pool) return Promise.resolve(false);

  if (!recoveryPromise) {
    let client: PoolClient | null = null;
    recoveryPromise = (async () => {
      try {
        client = await connectWithTimeout(() => originalConnect());
        databaseAvailable = true;
        return true;
      } catch (err) {
        console.warn('Database connection lost; reconnection attempt failed.', err);
        return false;
      } finally {
        if (client) client.release();
        recoveryPromise = null;
      }
    })();
  }

  return recoveryPromise;
}

type QueryMethod = Pool['query'];
type ConnectMethod = Pool['connect'];

let originalQuery!: QueryMethod;
let originalConnect!: ConnectMethod;

if (pool) {
  originalQuery = pool.query.bind(pool);
  originalConnect = pool.connect.bind(pool);

  const ensureAvailable = async (): Promise<boolean> => databaseAvailable || recoverDatabase();

  pool.query = (async (...args: Parameters<QueryMethod>) => {
    const available = await ensureAvailable();
    if (!available) {
      throw new Error('Database is not configured or not reachable');
    }
    return originalQuery(...args);
  }) as QueryMethod;

  pool.connect = (async (): Promise<PoolClient> => {
    const available = await ensureAvailable();
    if (!available) {
      throw new Error('Database is not configured or not reachable');
    }
    return originalConnect();
  }) as ConnectMethod;
}

// Idempotent DDL that mirrors db/schema.sql. Runs per-statement so a single
// failure (e.g. a table created by another route first) can never take the
// whole pool offline — only a failing connection disables it.
const schemaStatements: string[] = [
  `
    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genre TEXT NOT NULL,
      tracks_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active',
      bio TEXT DEFAULT '',
      followers INTEGER DEFAULT 0,
      featured_track TEXT DEFAULT '',
      monthly_listeners INTEGER DEFAULT 0,
      banner_url TEXT,
      profile_url TEXT,
      artist_id TEXT,
      email TEXT,
      total_downloads INTEGER NOT NULL DEFAULT 0,
      total_plays INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      contact VARCHAR(50),
      contact2 VARCHAR(50),
      profile_pic TEXT,
      age INTEGER,
      date_joined DATE,
      village VARCHAR(255),
      district VARCHAR(255),
      guardian_name VARCHAR(255),
      guardian_contact VARCHAR(50),
      sub_county VARCHAR(255),
      suspended_at TIMESTAMP,
      suspension_days INTEGER NOT NULL DEFAULT 0,
      category VARCHAR(100) NOT NULL DEFAULT 'Regular Members',
      status VARCHAR(50) DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS artist_media (
      id TEXT PRIMARY KEY,
      artist_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      album TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_url TEXT NOT NULL,
      drive_file_id TEXT,
      play_count INTEGER NOT NULL DEFAULT 0,
      download_count INTEGER NOT NULL DEFAULT 0,
      thumbnail_url TEXT,
      thumbnail_drive_file_id TEXT,
      featured_artist_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS artist_follows (
      artist_id TEXT NOT NULL,
      subscriber_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (artist_id, subscriber_id)
    );
  `,
  `
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
    );
  `,
  `
    ALTER TABLE artists
    ADD COLUMN IF NOT EXISTS artist_id TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS tracks_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_downloads INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_plays INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS featured_track TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS monthly_listeners INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS banner_url TEXT,
    ADD COLUMN IF NOT EXISTS profile_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `,
  `
    ALTER TABLE artists
    ALTER COLUMN artist_id DROP NOT NULL,
    ALTER COLUMN email DROP NOT NULL;
  `,
  `
    ALTER TABLE artist_media
    ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS featured_artist_name TEXT,
    ADD COLUMN IF NOT EXISTS featured_artist_id TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
  `,
  `
    ALTER TABLE storage_items
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'talk-show',
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
    ADD COLUMN IF NOT EXISTS thumbnail_drive_file_id TEXT;
  `,
  `
    ALTER TABLE members
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact VARCHAR(50),
    ADD COLUMN IF NOT EXISTS contact2 VARCHAR(50),
    ADD COLUMN IF NOT EXISTS profile_pic TEXT,
    ADD COLUMN IF NOT EXISTS age INTEGER,
    ADD COLUMN IF NOT EXISTS date_joined DATE,
    ADD COLUMN IF NOT EXISTS village VARCHAR(255),
    ADD COLUMN IF NOT EXISTS district VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guardian_contact VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sub_county VARCHAR(255),
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS suspension_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Regular Members',
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  `,
];

const initDatabase = async () => {
  if (!pool) {
    databaseAvailable = false;
    return;
  }

  let client: PoolClient | null = null;
  try {
    client = await connectWithTimeout(() => originalConnect());
  } catch (err) {
    databaseAvailable = false;
    console.warn('Database initialization skipped because PostgreSQL is unavailable.', err);
    return;
  }

  try {
    databaseAvailable = true;
    await Promise.all(schemaStatements.map((statement) => client!.query(statement).catch((error) => {
      console.warn('Database schema statement skipped:', error);
    })));
    console.log('Database tables verified/created successfully.');
  } catch (err) {
    console.warn('Database schema verification finished with non-critical errors.', err);
  } finally {
    client?.release();
  }
};

const databaseReady = initDatabase();

export async function ensureDatabaseReady() {
  await databaseReady;
}

export default (pool ?? noopPool) as Pool;
