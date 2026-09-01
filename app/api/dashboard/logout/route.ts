import { NextResponse } from 'next/server';

import { DASHBOARD_SESSION_COOKIE } from '@/lib/dashboard-auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DASHBOARD_SESSION_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
