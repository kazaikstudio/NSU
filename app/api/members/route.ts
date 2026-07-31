import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { recordActivity } from '@/lib/activity';

export async function GET() {
  try {
    await ensureDatabaseReady();
    const { rows } = await pool.query(`
      SELECT id, name, email, contact, profile_pic AS "profilePic", category, status
      FROM members
      ORDER BY created_at DESC
    `);
    return NextResponse.json({ members: rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabaseReady();
    const { name, email, contact, profilePic, category, status = 'Active' } = await request.json();

    if (!name || !email || !category) {
      return NextResponse.json({ error: 'Name, email, and category are required' }, { status: 400 });
    }

    const query = `
      INSERT INTO members (name, email, contact, profile_pic, category, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, contact, profile_pic AS "profilePic", category, status;
    `;
    const values = [name, email, contact, profilePic, category, status];
    const { rows } = await pool.query(query, values);
    await recordActivity({
      action: 'created',
      entityType: 'member',
      entityId: String(rows[0].id),
      description: `Created member ${rows[0].name}`,
    });

    return NextResponse.json({ member: rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
