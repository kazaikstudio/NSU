import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { recordActivity } from '@/lib/activity';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await ensureDatabaseReady();
    const {
      name,
      email,
      contact,
      contact2,
      profilePic,
      age,
      dateJoined,
      village,
      district,
      guardianName,
      guardianContact,
      subCounty,
      suspendedAt,
      suspensionDays,
      category,
      status = 'Active',
    } = await request.json();

    if (!name || !email || !category) {
      return NextResponse.json({ error: 'Name, email, and category are required' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `
        UPDATE members
        SET name = $1, email = $2, contact = $3, contact2 = $4, profile_pic = $5,
            age = $6, date_joined = $7, village = $8, district = $9,
            guardian_name = $10, guardian_contact = $11, sub_county = $12,
            suspended_at = $13, suspension_days = $14, category = $15, status = $16
        WHERE id = $17
        RETURNING id, name, email, contact, contact2, profile_pic AS "profilePic", age,
                  date_joined AS "dateJoined", village, district,
                  guardian_name AS "guardianName", guardian_contact AS "guardianContact",
                  sub_county AS "subCounty", suspended_at AS "suspendedAt",
                  suspension_days AS "suspensionDays", category, status
      `,
      [
        name,
        email,
        contact || null,
        contact2 || null,
        profilePic || null,
        Number(age) || null,
        dateJoined || null,
        village || null,
        district || null,
        guardianName || null,
        guardianContact || null,
        subCounty || null,
        status === 'Suspended' ? suspendedAt || null : null,
        status === 'Suspended' ? Number(suspensionDays) || 0 : 0,
        category,
        status,
        id,
      ]
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