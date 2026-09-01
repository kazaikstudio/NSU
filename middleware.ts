import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DASHBOARD_SESSION_COOKIE, verifyDashboardSessionToken } from '@/lib/dashboard-auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isDashboardApiRoute = pathname.startsWith('/api/dashboard/') && pathname !== '/api/dashboard/login';

  if (!isProtectedDashboardRoute && !isDashboardApiRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  const sessionUser = verifyDashboardSessionToken(token);

  if (sessionUser) {
    return NextResponse.next();
  }

  if (isDashboardApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/dashboard', request.url);
  loginUrl.searchParams.set('login', '1');
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/dashboard/:path*'],
};
