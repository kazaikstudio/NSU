import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    const expectedEmail = process.env.DASHBOARD_EMAIL || process.env.NEXT_PUBLIC_DASHBOARD_EMAIL || 'nollstudio@gmail.com';
    const expectedPassword = process.env.DASHBOARD_PASSWORD || process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || '12345';

    if (email === expectedEmail && password === expectedPassword) {
      return NextResponse.json({
        user: {
          email,
          full_name: 'Admin User',
          role: 'admin',
        },
      });
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
