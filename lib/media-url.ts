import { reportTrackCounts } from '@/lib/audio-counts';

export function isBucketObjectKey(id: string | null | undefined): id is string {
  if (typeof id !== 'string' || !id.trim()) {
    return false;
  }

  const normalized = decodeURIComponent(id).replace(/\\/g, '/');
  return /^[A-Za-z0-9._/-]+$/.test(normalized) && normalized.split('/').every((segment) => segment.length > 0);
}

export function extractStoredFileId(url: string | null | undefined) {
  if (!url) return null;

  try {
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/api\/dashboard\/media\/([^?]+)/) || decodedUrl.match(/\/d\/([^?]+)/) || decodedUrl.match(/[?&]id=([^&]+)/);
    const value = match?.[1]?.trim();
    return value ? decodeURIComponent(value) : null;
  } catch {
    const match = url.match(/\/api\/dashboard\/media\/([^?]+)/) || url.match(/\/d\/([^?]+)/) || url.match(/[?&]id=([^&]+)/);
    return match?.[1]?.trim() || null;
  }
}

const recentTrackPlayRequests = new Map<string, number>();

export function recordTrackPlay(fileUrl: string | null | undefined) {
  if (!fileUrl) return;
  const fileId = extractStoredFileId(fileUrl);
  if (!fileId) return;

  const now = Date.now();
  const lastRequestAt = recentTrackPlayRequests.get(fileId) ?? 0;
  if (now - lastRequestAt < 10_000) {
    return;
  }

  recentTrackPlayRequests.set(fileId, now);
  void fetch(`/api/dashboard/media/${encodeURIComponent(fileId)}?play=1`, {
    method: 'GET',
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data) return;
      // The ?play=1 endpoint increments the counters server-side and returns the
      // resulting values, so every playback anywhere can broadcast the live
      // numbers into the shared counts registry and keep all surfaces in sync.
      reportTrackCounts({
        src: fileUrl,
        ...(typeof data.trackPlays === 'number' ? { playCount: Number(data.trackPlays) } : {}),
        ...(typeof data.trackDownloads === 'number' ? { downloadCount: Number(data.trackDownloads) } : {}),
        ...(typeof data.artistTotalPlays === 'number' ? { artistTotalPlays: Number(data.artistTotalPlays) } : {}),
      });
    })
    .catch(() => {});
}

export function getStoredThumbnailUrl(
  fileUrl: string | null | undefined,
  thumbnailUrl?: string | null,
  size = 400,
) {
  if (thumbnailUrl) return thumbnailUrl;

  if (fileUrl && /\/api\/dashboard\/media\//i.test(fileUrl)) {
    return '/noll.jpg';
  }

  const fileId = extractStoredFileId(fileUrl);
  if (!fileId) return '/noll.jpg';

  return isBucketObjectKey(fileId)
    ? `/api/dashboard/media/${encodeURIComponent(fileId)}`
    : `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

export function getStoredMediaUrl(fileUrl: string | null | undefined, options?: { download?: boolean; filename?: string; title?: string; artist?: string }) {
  if (!fileUrl) return null;

  const fileId = extractStoredFileId(fileUrl);
  if (!fileId) return fileUrl;

  const mediaPath = `/api/dashboard/media/${encodeURIComponent(fileId)}`;

  if (!options?.download) {
    return mediaPath;
  }

  const params = new URLSearchParams({ download: '1' });
  if (options.filename) params.set('filename', options.filename);
  if (options.title) params.set('title', options.title);
  if (options.artist) params.set('artist', options.artist);

  return `${mediaPath}?${params.toString()}`;
}