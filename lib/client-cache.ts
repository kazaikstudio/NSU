const pendingClientRequests = new Map<string, Promise<unknown>>();
const completedClientRequests = new Set<string>();

export function getClientCachedData<T>(key: string, loader: () => Promise<T>) {
  const existingRequest = pendingClientRequests.get(key);
  if (existingRequest) return existingRequest as Promise<T>;

  const request = loader()
    .then((data) => {
      completedClientRequests.add(key);
      return data;
    })
    .catch((error: unknown) => {
      pendingClientRequests.delete(key);
      completedClientRequests.delete(key);
      throw error;
    });

  pendingClientRequests.set(key, request);
  return request;
}

export function hasClientCachedData(key: string) {
  return completedClientRequests.has(key);
}

const STORAGE_PREFIX = 'nsu-cache:';
const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  savedAt: number;
}

export function readCachedData<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || typeof entry.savedAt !== 'number') return null;
    if (Date.now() - entry.savedAt > ttlMs) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

export function writeCachedData<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    const entry: CacheEntry<T> = { value, savedAt: Date.now() };
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full or unavailable — ignore
  }
}
