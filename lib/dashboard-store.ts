import fs from 'node:fs';
import path from 'node:path';

export interface DashboardMediaItem {
  id: number;
  title: string;
  type: string;
  file_url: string;
  created_at: string;
}

interface DashboardStoreShape {
  media: DashboardMediaItem[];
}

const DATA_FILE = path.join(process.cwd(), '.dashboard-data.json');

function readStore(): DashboardStoreShape {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { media: [] };
    }

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DashboardStoreShape>;

    return {
      media: Array.isArray(parsed.media) ? parsed.media : [],
    };
  } catch {
    return { media: [] };
  }
}

function writeStore(store: DashboardStoreShape) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch {
    // Ignore file write failures and keep the UI responsive.
  }
}

export function readFallbackMedia(): DashboardMediaItem[] {
  return readStore().media;
}

export function writeFallbackMedia(items: DashboardMediaItem[]) {
  writeStore({ media: items });
}

export function shouldUseFallbackDb(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (!message) {
    return true;
  }

  return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|password authentication failed|timeout|connection.*failed|connect/i.test(message);
}
