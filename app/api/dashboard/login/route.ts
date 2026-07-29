import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

type DashboardUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

function getClient() {
  const connectionString =
    process.env.DATABASE_PUBLIC_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;

  if (connectionString) {
    return new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }

  return new Client({
    host: process.env.PGHOST || 'sakura.proxy.rlwy.net',
    port: Number(process.env.PGPORT || 43026),
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl: { rejectUnauthorized: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Please provide an email and password.' },
        { status: 400 }
      );
    }

    const client = getClient();

    try {
      await client.connect();

      await client.query(`
        CREATE TABLE IF NOT EXISTS dashboard_users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT DEFAULT 'user'
        )
      `);

      const existingUser = await client.query<DashboardUser>(
        `SELECT id, email, full_name, role
         FROM dashboard_users
         WHERE email = $1 AND password = $2
         LIMIT 1`,
        [email, password]
      );

      if (existingUser.rowCount === 0) {
        return NextResponse.json(
          { error: 'Invalid email or password.' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        user: existingUser.rows[0],
      });
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (error) {
    console.error('Dashboard login error:', error);
    return NextResponse.json(
      {
        error:
          'Unable to connect to PostgreSQL. Set DATABASE_PUBLIC_URL or DATABASE_URL, or provide PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE in your environment.',
      },
      { status: 500 }
    );
  }
}
