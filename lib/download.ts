export type DownloadCategory = 'audio' | 'video';

export const NOLL_STUDIO_DOWNLOAD_THUMBNAIL = '/noll.jpg';

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

export function buildDownloadFilename(filename: string, category?: DownloadCategory, artistName?: string) {
  const safeFilename = sanitizeDownloadFilename(filename);
  const resolvedCategory = category ?? inferDownloadCategoryFromFilename(safeFilename);
  const baseName = safeFilename.replace(/\.[^.]+$/, '');
  const extension = safeFilename.includes('.') ? `.${safeFilename.split('.').pop()}` : '';

  if (resolvedCategory === 'audio') {
    let normalizedBase = baseName.trim();
    normalizedBase = normalizedBase
      .replace(/^Noll[\s_-]*Music(?:[\s_-]*Audio)?[\s_-]*/i, '')
      .replace(/^Noll[\s_-]*Music[\s_-]*/i, '')
      .replace(/^Audio[\s_-]*/i, '')
      .trim();

    if (/\(Nollstudios\.org\)$/.test(normalizedBase)) {
      normalizedBase = normalizedBase.replace(/,\s*By\s+.+\(Nollstudios\.org\)$/, '').trim();
    }

    const normalizedArtist = artistName ? sanitizeDownloadFilename(artistName).trim() : '';
    const titleAndArtist = normalizedArtist ? `${normalizedBase}, By ${normalizedArtist}` : normalizedBase;
    const withSuffix = titleAndArtist ? `${titleAndArtist} (Nollstudios.org)` : 'Nollstudios.org';
    return `${withSuffix}${extension}`;
  }

  return safeFilename;
}

export function getAudioDownloadThumbnailUrl() {
  return NOLL_STUDIO_DOWNLOAD_THUMBNAIL;
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
  const titleAndArtist = normalizedArtist ? `${normalizedTitle}, By ${normalizedArtist}` : normalizedTitle;
  const withSuffix = titleAndArtist ? `${titleAndArtist} (Nollstudios.org)` : 'Nollstudios.org';
  return `${withSuffix}.${extension.replace(/^\./, '') || 'mp3'}`;
}
