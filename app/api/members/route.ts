import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { recordActivity } from '@/lib/activity';

export async function GET() {
  try {
    await ensureDatabaseReady();
    const { rows } = await pool.query(`
      SELECT id, name, email, contact, contact2, profile_pic AS "profilePic", age,
             date_joined AS "dateJoined", village, district,
             guardian_name AS "guardianName", guardian_contact AS "guardianContact",
             sub_county AS "subCounty", suspended_at AS "suspendedAt",
             suspension_days AS "suspensionDays", category, status
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

    const query = `
      INSERT INTO members (
        name, email, contact, contact2, profile_pic, age, date_joined, village,
        district, guardian_name, guardian_contact, sub_county, suspended_at,
        suspension_days, category, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id, name, email, contact, contact2, profile_pic AS "profilePic", age,
                date_joined AS "dateJoined", village, district,
                guardian_name AS "guardianName", guardian_contact AS "guardianContact",
                sub_county AS "subCounty", suspended_at AS "suspendedAt",
                suspension_days AS "suspensionDays", category, status;
    `;
    const values = [
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
    ];
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
