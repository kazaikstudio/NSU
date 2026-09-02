import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveDatabaseConnectionString } from './db';

test('resolveDatabaseConnectionString prefers a real configured DATABASE_URL', () => {
  const value = resolveDatabaseConnectionString({
    DATABASE_URL: 'postgresql://postgres:secret@host:5432/railway',
    POSTGRES_URL: 'postgresql://postgres:other@fallback:5432/railway',
  });

  assert.equal(value, 'postgresql://postgres:secret@host:5432/railway');
});

test('resolveDatabaseConnectionString builds a URL from PG* vars when DATABASE_URL is missing', () => {
  const value = resolveDatabaseConnectionString({
    PGHOST: 'sakura.proxy.rlwy.net',
    PGPORT: '43026',
    PGDATABASE: 'railway',
    PGUSER: 'postgres',
    PGPASSWORD: 'secret',
  });

  assert.equal(value, 'postgresql://postgres:secret@sakura.proxy.rlwy.net:43026/railway');
});
