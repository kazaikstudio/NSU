import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

function resolveEnvTemplate(value?: string) {
  if (!value) return undefined;
  return value.replace(/\$\{\{([^}]+)\}\}|\$\{([A-Za-z0-9_]+)\}/g, (_, bracketValue, plainValue) => {
    const key = bracketValue || plainValue;
    return process.env[key] ?? '';
  });
}

function getClient() {
  const connectionString = resolveEnvTemplate(
    process.env.DATABASE_PUBLIC_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL
  );

  if (connectionString) {
    return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  }

  return new Client({
    host: process.env.PGHOST || 'sakura.proxy.rlwy.net',
    port: Number(process.env.PGPORT || 43026),
    database: process.env.PGDATABASE || 'railway',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: { rejectUnauthorized: false },
  });
}

export async function GET() {
  const client = getClient();

  try {
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS dashboard_media (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        file_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await client.query(
      `SELECT id, title, type, file_url, created_at
       FROM dashboard_media
       ORDER BY created_at DESC`
    );

    return NextResponse.json({ media: result.rows });
  } catch (error) {
    console.error('Storage fetch error:', error);
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 });
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const title = String(formData.get('title') || '').trim();
    const type = String(formData.get('type') || '').trim();
    const file = formData.get('file');

    if (!title || !type || !file || typeof file === 'string') {
      return NextResponse.json({ error: 'Title, type and file are required.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${Date.now()}-${(file as File).name.replace(/\s+/g, '-')}`;
    const fileUrl = `data:${(file as File).type};base64,${buffer.toString('base64')}`;

    const client = getClient();

    try {
      await client.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS dashboard_media (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          file_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(
        `INSERT INTO dashboard_media (title, type, file_url)
         VALUES ($1, $2, $3)`,
        [title, type, fileUrl]
      );

      return NextResponse.json({ success: true, fileName, fileUrl });
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (error) {
    console.error('Storage upload error:', error);
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
