export type DownloadCategory = 'audio' | 'video';

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

export function getDownloadPath(filename: string, category?: DownloadCategory) {
  const safeFilename = sanitizeDownloadFilename(filename);
  const resolvedCategory = category ?? inferDownloadCategoryFromFilename(safeFilename);
  const baseName = safeFilename.replace(/\.[^.]+$/, '');
  const extension = safeFilename.includes('.') ? `.${safeFilename.split('.').pop()}` : '';

  if (resolvedCategory === 'audio') {
    const normalizedBase = baseName.trim();
    const withSuffix = normalizedBase ? `${normalizedBase} - Noll Music` : 'Noll Music';
    return `Noll-Music/Audio/${withSuffix}${extension}`;
  }

  return `Noll-Music/Video/${safeFilename}`;
}
