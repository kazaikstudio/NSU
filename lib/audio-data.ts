import { readCachedData, writeCachedData } from './client-cache';

const CACHE_KEY = 'audio:shared-data';

export interface AudioDataTrack {
  id: string;
  title: string;
  album?: string | null;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  artistId: string;
  artistName: string;
  featuredArtistName?: string | null;
  featuredArtistId?: string | null;
  artistGenre?: string | null;
  artistProfileUrl?: string | null;
  thumbnailUrl?: string | null;
  thumbnailDriveFileId?: string | null;
  driveFileId?: string | null;
  downloadCount?: number;
  playCount?: number;
}

export interface AudioDataStorageItem {
  title?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
}

export interface AudioPageResponse {
  tracks: AudioDataTrack[];
  storageItems?: AudioDataStorageItem[];
  fallback?: boolean;
}

let inFlight: Promise<AudioPageResponse> | null = null;

export function readCachedAudioData(): AudioPageResponse | null {
  return readCachedData<AudioPageResponse>(CACHE_KEY);
}

export async function fetchAudioData(): Promise<AudioPageResponse> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch('/api/audio');
    if (!response.ok) {
      throw new Error(response.statusText || 'Failed to load audio data');
    }
    const data = (await response.json()) as AudioPageResponse;
    // Never overwrite good cached data with a fallback/demo payload — a
    // transient database outage should keep the last-known-good list around
    // instead of replacing it with demo tracks.
    if (!data.fallback) {
      writeCachedData(CACHE_KEY, data);
    }
    return data;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
