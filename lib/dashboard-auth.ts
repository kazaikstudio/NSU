import { cookies } from 'next/headers';

export type DashboardUser = {
  email: string;
  full_name: string;
  role: string;
};

export const DASHBOARD_SESSION_COOKIE = 'nsu_dashboard_session';

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function createDashboardSessionToken(user: DashboardUser) {
  return toBase64Url(JSON.stringify(user));
}

export function verifyDashboardSessionToken(token: string | undefined | null): DashboardUser | null {
  if (!token) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(token)) as Partial<DashboardUser>;
    if (
      typeof parsed.email !== 'string' ||
      typeof parsed.full_name !== 'string' ||
      typeof parsed.role !== 'string'
    ) {
      return null;
    }

    return {
      email: parsed.email,
      full_name: parsed.full_name,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export async function getDashboardSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  return verifyDashboardSessionToken(token);
}

export function getDashboardSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_WEEK_IN_SECONDS,
  };
}
