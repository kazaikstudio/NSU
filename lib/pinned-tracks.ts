const PINNED_TRACKS_KEY = 'audio-page:pinned-tracks';
const EMPTY_PINNED_TRACKS: string[] = [];

let cachedRaw: string | null = null;
let cachedValue: string[] = EMPTY_PINNED_TRACKS;
const listeners = new Set<() => void>();

function parsePinnedTracks(raw: string | null): string[] {
  if (!raw) return EMPTY_PINNED_TRACKS;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : EMPTY_PINNED_TRACKS;
  } catch {
    return EMPTY_PINNED_TRACKS;
  }
}

export function getPinnedTrackFileUrls(): string[] {
  if (typeof window === 'undefined') return EMPTY_PINNED_TRACKS;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PINNED_TRACKS_KEY);
  } catch {
    raw = null;
  }

  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  cachedValue = parsePinnedTracks(raw);
  return cachedValue;
}

export function subscribePinnedTracks(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const invalidate = () => {
    cachedRaw = null;
    callback();
  };

  listeners.add(invalidate);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PINNED_TRACKS_KEY) invalidate();
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(invalidate);
    window.removeEventListener('storage', handleStorage);
  };
}

function emitPinnedTracksChange(): void {
  cachedRaw = null;
  listeners.forEach((listener) => listener());
}

export function setPinnedTrackFileUrls(fileUrls: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(PINNED_TRACKS_KEY, JSON.stringify(Array.from(new Set(fileUrls))));
  } catch {
    // storage unavailable or full — ignore
  }

  emitPinnedTracksChange();
}

export function togglePinnedTrackFileUrl(fileUrl: string): string[] {
  const next = new Set(getPinnedTrackFileUrls());
  if (next.has(fileUrl)) {
    next.delete(fileUrl);
  } else {
    next.add(fileUrl);
  }
  const urls = Array.from(next);
  setPinnedTrackFileUrls(urls);
  return urls;
}

export function isPinnedTrackFileUrl(fileUrl: string | null | undefined): boolean {
  if (!fileUrl) return false;
  return getPinnedTrackFileUrls().includes(fileUrl);
}