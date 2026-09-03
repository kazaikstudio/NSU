const DEFAULT_ALLOWED_ORIGINS = [
  'https://nollstudios.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

export function getAllowedOrigins() {
  const configured = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined,
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined,
    process.env.APP_URL,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured.map(normalizeOrigin)]));
}

export function resolveAllowedOrigin(origin: string | null) {
  const allowedOrigins = getAllowedOrigins();
  if (origin) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) {
      return normalizedOrigin;
    }
  }

  return allowedOrigins[0];
}
