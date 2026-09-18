import { Pool } from 'pg';

const cs = String(process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL);

async function attempt(label: string, ssl: object | boolean) {
  const pool = new Pool({ connectionString: cs, ssl, connectionTimeoutMillis: 12000, max: 2 });
  const start = Date.now();
  try {
    const r = await pool.query('SELECT COUNT(*)::int AS c FROM artists');
    console.log(`${label} => OK count=${r.rows[0].c} in ${Date.now() - start}ms`);
  } catch (e) {
    console.log(`${label} => FAIL (${Date.now() - start}ms):`, (e as Error).message);
  }
  await pool.end().catch(() => {});
}

await attempt('no-ssl      ', false);
await attempt('ssl-rejectUn', { rejectUnauthorized: false });
await attempt('ssl-true    ', true);