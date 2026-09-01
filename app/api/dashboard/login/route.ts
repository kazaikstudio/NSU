import { NextResponse } from 'next/server';
import {
  DASHBOARD_SESSION_COOKIE,
  createDashboardSessionToken,
  getDashboardSessionCookieOptions,
  type DashboardUser,
} from '@/lib/dashboard-auth';

function getExpectedDashboardCredentials() {
  return {
    email: (
      process.env.DASHBOARD_EMAIL ||
      process.env.NEXT_PUBLIC_DASHBOARD_EMAIL ||
      'nollstudio@gmail.com'
    ).trim(),
    password: (
      process.env.DASHBOARD_PASSWORD ||
      process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD ||
      '12345'
    ).trim(),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password.trim() : '';

    const expected = getExpectedDashboardCredentials();

    if (email === expected.email && password === expected.password) {
      const user: DashboardUser = {
        email,
        full_name: 'Admin User',
        role: 'admin',
      };

      const response = NextResponse.json({ user });
      response.cookies.set(
        DASHBOARD_SESSION_COOKIE,
        createDashboardSessionToken(user),
        getDashboardSessionCookieOptions(),
      );
      return response;
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, '', {
    ...getDashboardSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
