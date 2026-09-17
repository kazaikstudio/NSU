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

const guardUnavailablePool = () => {
  if (!pool) return;

  const originalQuery = pool.query.bind(pool);
  const originalConnect = pool.connect.bind(pool);

  pool.query = ((...args: Parameters<typeof originalQuery>) => {
    if (!databaseAvailable) {
      return Promise.reject(new Error('Database is not configured or not reachable'));
    }
    return originalQuery(...args);
  }) as typeof pool.query;

  pool.connect = ((...args: Parameters<typeof originalConnect>) => {
    if (!databaseAvailable) {
      return Promise.reject(new Error('Database is not configured or not reachable'));
    }
    return originalConnect(...args);
  }) as typeof pool.connect;
};

guardUnavailablePool();

// Automatically create tables on initialization
const initDatabase = async () => {
  if (!pool) {
    databaseAvailable = false;
    return;
  }

  try {
    const client = await connectWithTimeout(() => pool.connect());
    try {
      databaseAvailable = true;

      await client.query(`
        CREATE TABLE IF NOT EXISTS artists (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          genre VARCHAR(100) NOT NULL,
          tracks_count INT DEFAULT 0,
          total_plays INTEGER NOT NULL DEFAULT 0,
          total_downloads INTEGER NOT NULL DEFAULT 0,
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS members (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          contact VARCHAR(50),
          profile_pic TEXT,
          category VARCHAR(100) NOT NULL,
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        ALTER TABLE artists
        ADD COLUMN IF NOT EXISTS artist_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS tracks_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_downloads INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_plays INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);

      await client.query(`
        ALTER TABLE artists
        ALTER COLUMN artist_id DROP NOT NULL,
        ALTER COLUMN email DROP NOT NULL;
      `);

      await client.query(`
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
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS artist_follows (
          artist_id TEXT NOT NULL,
          subscriber_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (artist_id, subscriber_id)
        );
      `);
      await client.query(`
        ALTER TABLE artist_media
        ADD COLUMN IF NOT EXISTS play_count INTEGER NOT NULL DEFAULT 0
      `);
      console.log('Database tables verified/created successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    databaseAvailable = false;
    console.warn('Database initialization skipped because PostgreSQL is unavailable.', err);
  }
};

const databaseReady = initDatabase();

export async function ensureDatabaseReady() {
  await databaseReady;
}

export default (pool ?? noopPool) as Pool;
