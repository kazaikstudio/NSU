export interface DashboardMediaItem {
  id: number;
  title: string;
  type: string;
  file_url: string;
  created_at: string;
}

const STORAGE_KEY = 'noll-dashboard-media';

export function readFallbackMedia(): DashboardMediaItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as { media?: DashboardMediaItem[] };
    return Array.isArray(parsed.media) ? parsed.media : [];
  } catch {
    return [];
  }
}

export function writeFallbackMedia(items: DashboardMediaItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ media: items }));
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
}

export function shouldUseFallbackDb(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (!message) {
    return true;
  }

  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|password authentication failed|timeout|connection.*failed|connect/i.test(message);
}
