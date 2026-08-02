// lib/db.ts
import { Pool, PoolClient } from 'pg';

type DatabasePool = Pick<Pool, 'query' | 'connect' | 'end'>;

const configuredConnectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const connectionString = configuredConnectionString && !/USER|PASSWORD|your_railway_postgres_url/i.test(configuredConnectionString)
  ? configuredConnectionString
  : undefined;
const hasConfiguredDatabase = Boolean(connectionString);

const pool = hasConfiguredDatabase
  ? new Pool({
      connectionString,
      ssl: connectionString && /railway|rlwy/i.test(connectionString)
        ? { rejectUnauthorized: false }
        : process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    })
  : null;

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
  const timeoutMs = 2000;
  return Promise.race([
    connectFn(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timed out')), timeoutMs);
    }),
  ]);
};

// Automatically create tables on initialization
const initDatabase = async () => {
  if (!pool) {
    return;
  }

  try {
    const client = await connectWithTimeout(() => pool.connect());
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS artists (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          genre VARCHAR(100) NOT NULL,
          tracks_count INT DEFAULT 0,
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
        ADD COLUMN IF NOT EXISTS profile_pic TEXT,
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
      console.log('Database tables verified/created successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('Database initialization skipped because PostgreSQL is unavailable.', err);
  }
};

const databaseReady = initDatabase();

export async function ensureDatabaseReady() {
  await databaseReady;
}

export default (pool ?? noopPool) as Pool;
