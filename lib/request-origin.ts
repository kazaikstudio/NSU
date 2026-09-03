const DEFAULT_ALLOWED_ORIGINS = [
  'https://nollstudios.org',
  'https://www.nollstudios.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, '');
}

function expandHostnameVariants(value: string) {
  const normalized = normalizeOrigin(value);
  if (!normalized) return [];

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const variants = new Set<string>([`${url.protocol}//${host}`]);

    if (host === 'nollstudios.org') {
      variants.add('https://nollstudios.org');
      variants.add('https://www.nollstudios.org');
    }

    if (host === 'www.nollstudios.org') {
      variants.add('https://nollstudios.org');
      variants.add('https://www.nollstudios.org');
    }

    if (host.endsWith('.railway.app')) {
      variants.add(`https://${host}`);
      variants.add(`https://www.${host}`);
    }

    return Array.from(variants);
  } catch {
    return [normalized];
  }
}

export function getAllowedOrigins() {
  const configured = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined,
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined,
    process.env.APP_URL,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const expanded = configured.flatMap(expandHostnameVariants);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...expanded.map(normalizeOrigin)]));
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
