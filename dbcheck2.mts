process.loadEnvFile('.env');
import { Pool } from 'pg';

function resolve(candidates: (string | undefined)[]) {
  const lookalike = /USER:PASSWORD|USERNAME:PASSWORD|your_railway_postgres_url|replace_with|example\.com|<username>|<password>|\/\$\{.*\}|placeholder/i;
  const isPrivate = (v: string) => {
    try {
      const h = new URL(v).hostname.toLowerCase();
      return h.endsWith('.railway.internal') || h === 'railway.internal';
    } catch {
      return false;
    }
  };
  return candidates
    .filter((v): v is string => Boolean(v && v.trim()))
    .map((v) => v.trim())
    .find((v) => !isPrivate(v) && !lookalike.test(v));
}

const cs = resolve([process.env.DATABASE_URL, process.env.POSTGRES_URL, process.env.DATABASE_PUBLIC_URL, process.env.NEXT_PUBLIC_DATABASE_URL]);
console.log('resolved host:', cs ? new URL(cs).hostname : 'none');

const pool = new Pool({ connectionString: cs, connectionTimeoutMillis: 15000, max: 2 });
try {
  const count = await pool.query('SELECT COUNT(*)::int AS c FROM artists');
  console.log('ARTISTS_COUNT=', count.rows[0].c);
} catch (e) {
  console.log('QUERY_FAIL:', (e as Error).message);
}
try {
  const res = await pool.query(`SELECT media.id, media.title, art.name FROM artist_media media INNER JOIN artists art ON art.id::text = media.artist_id WHERE media.kind='track' LIMIT 3`);
  console.log('TRACK_SAMPLE=', JSON.stringify(res.rows));
} catch (e) {
  console.log('TRACK_QUERY_FAIL:', (e as Error).message);
}
try {
  const res = await pool.query(`SELECT COUNT(*)::int AS c FROM storage_items`);
  console.log('STORAGE_COUNT=', res.rows[0].c);
} catch (e) {
  console.log('STORAGE_QUERY_FAIL:', (e as Error).message);
}
await pool.end();