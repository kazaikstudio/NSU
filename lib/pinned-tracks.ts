'use client';

import { useEffect, useSyncExternalStore } from 'react';

const EMPTY_PINNED_TRACKS: string[] = [];

let pinnedFileUrls: string[] = EMPTY_PINNED_TRACKS;
const listeners = new Set<() => void>();

function getPinnedSnapshot(): string[] {
  return pinnedFileUrls;
}

function emitPinnedTracksChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribePinnedTracks(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getPinnedTrackFileUrls(): string[] {
  if (typeof window === 'undefined') return EMPTY_PINNED_TRACKS;
  return getPinnedSnapshot();
}

function applyPinnedTrackFileUrls(fileUrls: string[]): void {
  pinnedFileUrls = Array.from(new Set(fileUrls.filter((url) => typeof url === 'string')));
  emitPinnedTracksChange();
}

let pinnedLoadPromise: Promise<void> | null = null;

export async function loadPinnedTracks(): Promise<void> {
  if (pinnedLoadPromise) return pinnedLoadPromise;

  pinnedLoadPromise = (async () => {
    try {
      const response = await fetch('/api/pinned-tracks', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { fileUrls?: unknown };
      if (Array.isArray(data.fileUrls)) {
        applyPinnedTrackFileUrls(data.fileUrls as string[]);
      }
    } catch {
      // Keep whatever is in memory when the network is unavailable.
    } finally {
      pinnedLoadPromise = null;
    }
  })();

  return pinnedLoadPromise;
}

async function persistPinnedTrackFileUrls(fileUrls: string[]): Promise<void> {
  try {
    await fetch('/api/pinned-tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrls }),
      cache: 'no-store',
    });
    await loadPinnedTracks();
  } catch {
    // Local state stays authoritative even if persisting fails.
  }
}

export function setPinnedTrackFileUrls(fileUrls: string[]): void {
  const next = Array.from(new Set(fileUrls.filter((url) => typeof url === 'string')));
  applyPinnedTrackFileUrls(next);
  void persistPinnedTrackFileUrls(next);
}

export function togglePinnedTrackFileUrl(fileUrl: string): string[] {
  const next = new Set(pinnedFileUrls);
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
  return pinnedFileUrls.includes(fileUrl);
}

export function usePinnedTrackFileUrls(): string[] {
  const fileUrls = useSyncExternalStore(subscribePinnedTracks, getPinnedSnapshot, getPinnedSnapshot);

  useEffect(() => {
    void loadPinnedTracks();
  }, []);

  return fileUrls;
}