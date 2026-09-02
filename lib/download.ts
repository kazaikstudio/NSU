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

export function buildDownloadFilename(filename: string, category?: DownloadCategory) {
  const safeFilename = sanitizeDownloadFilename(filename);
  const resolvedCategory = category ?? inferDownloadCategoryFromFilename(safeFilename);
  const baseName = safeFilename.replace(/\.[^.]+$/, '');
  const extension = safeFilename.includes('.') ? `.${safeFilename.split('.').pop()}` : '';

  if (resolvedCategory === 'audio') {
    const normalizedBase = baseName.trim();
    const withSuffix = normalizedBase ? `${normalizedBase} - Nollstudios.org` : 'Nollstudios.org';
    return `${withSuffix}${extension}`;
  }

  return safeFilename;
}

export function getAudioDownloadThumbnailUrl() {
  return NOLL_STUDIO_DOWNLOAD_THUMBNAIL;
}

export function getDownloadPath(filename: string, category?: DownloadCategory) {
  const resolvedFilename = buildDownloadFilename(filename, category);
  const resolvedCategory = category ?? inferDownloadCategoryFromFilename(filename);

  if (resolvedCategory === 'audio') {
    return `Noll-Music/Audio/${resolvedFilename}`;
  }

  return `Noll-Music/Video/${resolvedFilename}`;
}
