export interface TrackCountsSnapshot {
  src: string;
  playCount?: number;
  downloadCount?: number;
  artist?: string;
  artistTotalPlays?: number;
  artistTotalDownloads?: number;
}

type TrackCountsListener = (snapshot: TrackCountsSnapshot) => void;

// Single client-side source of truth for live play/download counts, keyed by
// the same playable media URL the now-playing registry uses so every surface
// (rows, lists, cards, full-screen player, artist pages) shows identical,
// incrementing numbers no matter where the playback/download happened.
const countsBySrc = new Map<string, TrackCountsSnapshot>();
const listenersBySrc = new Map<string, Set<TrackCountsListener>>();

function notify(src: string, snapshot: TrackCountsSnapshot) {
  listenersBySrc.get(src)?.forEach((listener) => listener(snapshot));
}

export function reportTrackCounts(snapshot: TrackCountsSnapshot) {
  if (!snapshot?.src) return;

  const current = countsBySrc.get(snapshot.src);
  const next: TrackCountsSnapshot = current ? { ...current, ...snapshot } : { ...snapshot };
  // Never let an undefined field erase a previously known live count.
  (Object.keys(next) as Array<keyof TrackCountsSnapshot>).forEach((key) => {
    if (next[key] === undefined) delete next[key];
  });
  if (!next.src) return;

  countsBySrc.set(next.src, next);
  notify(next.src, next);
}

export function getTrackCounts(src: string): TrackCountsSnapshot | undefined {
  return countsBySrc.get(src);
}

export function subscribeTrackCounts(src: string, listener: TrackCountsListener): () => void {
  const current = countsBySrc.get(src);
  if (current) listener(current);

  let set = listenersBySrc.get(src);
  if (!set) {
    set = new Set();
    listenersBySrc.set(src, set);
  }
  set.add(listener);

  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listenersBySrc.delete(src);
  };
}