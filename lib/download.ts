export type DownloadCategory = 'audio' | 'video';

export const NOLL_STUDIO_DOWNLOAD_THUMBNAIL = '/noll.jpg';

export function getSiteBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  const configured = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined,
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : undefined,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return configured[0]?.replace(/\/$/, '') || 'https://nollstudios.org';
}

export function resolveAssetUrl(url?: string | null) {
  if (!url || !url.trim()) return `${getSiteBaseUrl()}/noll.jpg`;

  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return new URL(trimmed, getSiteBaseUrl()).toString();
  }

  return trimmed;
}

export function sanitizeDownloadFilename(filename: string) {
  return filename
    .replace(/[\n"\\/:*?<>|]+/g, '_')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/_+/g, ' ')
    .replace(/\s+\./g, '.');
}

export function inferDownloadCategoryFromFilename(filename: string): DownloadCategory {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'opus', 'ogg'];
  return audioExtensions.includes(extension) ? 'audio' : 'video';
}

export function normalizeAudioDownloadExtension(extension?: string | null) {
  return 'mp3';
}

export function buildDownloadFilename(filename: string, category?: DownloadCategory, artistName?: string) {
  const safeFilename = sanitizeDownloadFilename(filename);
  const resolvedCategory = category ?? inferDownloadCategoryFromFilename(safeFilename);
  const baseName = safeFilename.replace(/\.[^.]+$/, '');
  const extension = resolvedCategory === 'audio' ? '.mp3' : safeFilename.includes('.') ? `.${safeFilename.split('.').pop()}` : '';

  if (resolvedCategory === 'audio') {
    let normalizedBase = baseName.trim();
    normalizedBase = normalizedBase
      .replace(/^Noll[\s_-]*Music(?:[\s_-]*Audio)?[\s_-]*/i, '')
      .replace(/^Noll[\s_-]*Music[\s_-]*/i, '')
      .replace(/^Audio[\s_-]*/i, '')
      .trim();

    if (/\(Nollstudios\.org\)$/.test(normalizedBase)) {
      normalizedBase = normalizedBase
        .replace(/\s+By\s+artist\s*=\s*.+\(Nollstudios\.org\)$/i, '')
        .replace(/,\s*By\s+.+\(Nollstudios\.org\)$/i, '')
        .trim();
    }

    const normalizedArtist = artistName ? sanitizeDownloadFilename(artistName).trim() : '';
    const titleAndArtist = normalizedArtist ? `${normalizedBase} By artist = ${normalizedArtist}` : normalizedBase;
    const withSuffix = titleAndArtist ? `${titleAndArtist} (Nollstudios.org)` : 'Nollstudios.org';
    return `${withSuffix}${extension}`;
  }

  return safeFilename;
}

export function getAudioDownloadThumbnailUrl(thumbnailUrl?: string | null) {
  if (thumbnailUrl && thumbnailUrl.trim()) {
    return resolveAssetUrl(thumbnailUrl);
  }

  return resolveAssetUrl(NOLL_STUDIO_DOWNLOAD_THUMBNAIL);
}

export function getDownloadPath(filename: string, category?: DownloadCategory, artistName?: string) {
  const resolvedFilename = buildDownloadFilename(filename, category, artistName);
  const resolvedCategory = category ?? inferDownloadCategoryFromFilename(filename);

  if (resolvedCategory === 'audio') {
    return resolvedFilename;
  }

  return resolvedFilename;
}

export function buildAudioDownloadName(title: string, artistName?: string, extension = 'mp3') {
  let normalizedTitle = sanitizeDownloadFilename(title || '').trim();
  normalizedTitle = normalizedTitle
    .replace(/^Noll[\s_-]*Music(?:[\s_-]*Audio)?[\s_-]*/i, '')
    .replace(/^Noll[\s_-]*Music[\s_-]*/i, '')
    .replace(/^Audio[\s_-]*/i, '')
    .trim();

  const normalizedArtist = artistName ? sanitizeDownloadFilename(artistName).trim() : '';
  const titleAndArtist = normalizedArtist ? `${normalizedTitle} By artist = ${normalizedArtist}` : normalizedTitle;
  const withSuffix = titleAndArtist ? `${titleAndArtist} (Nollstudios.org)` : 'Nollstudios.org';
  const audioExtension = normalizeAudioDownloadExtension(extension);
  return `${withSuffix}.${audioExtension}`;
}