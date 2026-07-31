import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { recordActivity } from '@/lib/activity';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await ensureDatabaseReady();
    const { name, email, contact, profilePic, category, status = 'Active' } = await request.json();

    if (!name || !email || !category) {
      return NextResponse.json({ error: 'Name, email, and category are required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `
        UPDATE members
        SET name = $1, email = $2, contact = $3, profile_pic = $4, category = $5, status = $6
        WHERE id = $7
        RETURNING id, name, email, contact, profile_pic AS "profilePic", category, status
      `,
      [name, email, contact || null, profilePic || null, category, status, id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await recordActivity({
      action: 'updated',
      entityType: 'member',
      entityId: id,
      description: `Updated member ${rows[0].name}`,
    });

    return NextResponse.json({ member: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await ensureDatabaseReady();
    const result = await pool.query('DELETE FROM members WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    await recordActivity({
      action: 'deleted',
      entityType: 'member',
      entityId: id,
      description: `Deleted member ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}