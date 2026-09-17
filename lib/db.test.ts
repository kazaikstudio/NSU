import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDatabasePoolConfig, getDatabaseConnectionString, resolveDatabaseConnectionString } from './db';

test('resolveDatabaseConnectionString prefers a real configured DATABASE_URL', () => {
  const value = resolveDatabaseConnectionString({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:secret@host:5432/railway',
    POSTGRES_URL: 'postgresql://postgres:other@fallback:5432/railway',
  });

  assert.equal(value, 'postgresql://postgres:secret@host:5432/railway');
});

test('resolveDatabaseConnectionString builds a URL from PG* vars when DATABASE_URL is missing', () => {
  const value = resolveDatabaseConnectionString({
    NODE_ENV: 'test',
    PGHOST: 'sakura.proxy.rlwy.net',
    PGPORT: '43026',
    PGDATABASE: 'railway',
    PGUSER: 'postgres',
    PGPASSWORD: 'secret',
  });

  assert.equal(value, 'postgresql://postgres:secret@sakura.proxy.rlwy.net:43026/railway');
});

test('resolveDatabaseConnectionString prefers the public Railway URL over an internal Railway hostname', () => {
  const value = resolveDatabaseConnectionString({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://postgres:secret@postgres-cskt.railway.internal:5432/railway',
    DATABASE_PUBLIC_URL: 'postgresql://postgres:secret@iriguchi.proxy.rlwy.net:39303/railway',
    PGHOST: 'postgres-cskt.railway.internal',
    PGPORT: '5432',
    PGDATABASE: 'railway',
    PGUSER: 'postgres',
    PGPASSWORD: 'secret',
  });

  assert.equal(value, 'postgresql://postgres:secret@iriguchi.proxy.rlwy.net:39303/railway');
});

test('getDatabaseConnectionString ignores placeholder Railway values and prefers the live config', () => {
  const value = getDatabaseConnectionString({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://USER:PASSWORD@sakura.proxy.rlwy.net:43026/railway',
    POSTGRES_URL: 'postgresql://postgres:secret@sakura.proxy.rlwy.net:43026/railway',
    PGHOST: 'sakura.proxy.rlwy.net',
    PGPORT: '43026',
    PGDATABASE: 'railway',
    PGUSER: 'postgres',
    PGPASSWORD: 'secret',
  });

  assert.equal(value, 'postgresql://postgres:secret@sakura.proxy.rlwy.net:43026/railway');
});

test('buildDatabasePoolConfig sets a fast connection timeout so blocked DB connections fail instead of hanging', () => {
  const config = buildDatabasePoolConfig({
    connectionString: 'postgresql://postgres:secret@localhost:5432/app',
    isProduction: false,
  });

  assert.equal(config.connectionString, 'postgresql://postgres:secret@localhost:5432/app');
  assert.equal(config.connectionTimeoutMillis, 2000);
  assert.equal(config.idleTimeoutMillis, 2000);
  assert.equal(config.max, 2);
});

