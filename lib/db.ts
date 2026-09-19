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
  const timeoutMs = Number(process.env.DATABASE_TIMEOUT_MS || 2000);

  return {
    connectionString,
    ssl: connectionString && /railway|rlwy/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : isProduction
        ? { rejectUnauthorized: false }
        : false,
    keepAlive: true,
    // Railway's database can take a while to wake from a cold start, and
    // between page loads a too-short idle timeout makes the pool throw away
    // a perfectly good connection, forcing a slow reconnect on every visit.
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || timeoutMs * 3),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 60000),
    query_timeout: Number(process.env.QUERY_TIMEOUT_MS || 60000),
    max: Number(process.env.PGPOOL_MAX || 4),
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

const connectWithTimeout = (connectFn: () => Promise<PoolClient>) => {
  const timeoutMs = Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || process.env.DATABASE_TIMEOUT_MS || 6000);
  return new Promise<PoolClient>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Database connection timed out'));
    }, timeoutMs);

    connectFn().then(
      (client) => {
        if (settled) {
          // The caller already gave up waiting for this connection. Hand the
          // client back to the pool instead of abandoning it, otherwise the
          // slot is leaked forever and (with a tiny pool) every later request
          // wedges waiting for a free connection.
          client.release();
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(client);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
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

  // pg-pool's Pool.prototype.query internally calls `this.connect(cb)` — and
  // other callers use both callback and promise forms of connect. The previous
  // wrapper here was an async `() => client` that swallowed the callback, so
  // after it the pool's query path silently hung: pg checked out an idle
  // client and then waited forever for the callback that never fired. Mirror
  // pg's real connect contract: callback form `(err, client, release)` and
  // promise form `Promise<PoolClient>`.
  pool.connect = ((...args: unknown[]) => {
    const callback =
      typeof args[0] === 'function'
        ? (args[0] as (err: Error | undefined, client?: PoolClient, release?: (err?: Error) => void) => void)
        : undefined;

    const attempt = async () => {
      const available = await ensureAvailable();
      if (!available) {
        throw new Error('Database is not configured or not reachable');
      }
      return connectWithTimeout(() => originalConnect());
    };

    if (callback) {
      attempt().then(
        (client) => callback(undefined, client, client.release),
        (err: unknown) => callback(err instanceof Error ? err : new Error(String(err))),
      );
      return undefined;
    }

    return attempt();
  }) as ConnectMethod;
}

// Idempotent DDL that mirrors db/schema.sql. Statements are grouped into a
// handful of batches: each batch runs as one round trip with the client kept
// free between awaits. Never run these concurrently on a single pg client —
// queued `client.query()` calls (Promise.all) leave the connection permanently
// "busy", after which every later pool.query on it queues forever and the whole
// app hangs on database-backed routes.
const schemaBatches: string[] = [
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
    CREATE TABLE IF NOT EXISTS artist_follows (
      artist_id TEXT NOT NULL,
      subscriber_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (artist_id, subscriber_id)
    );
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
    // Sequential, one batch at a time on the single connection: pg queues
    // concurrent client.query() calls and can leave the client stuck forever.
    for (const batch of schemaBatches) {
      await client!.query(batch).catch((error) => {
        console.warn('Database schema batch skipped:', error);
      });
    }
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
