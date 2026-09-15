export interface NowPlayingSnapshot {
  src: string;
  currentTime: number;
  isPlaying: boolean;
  title: string;
  artist?: string;
  thumbnailUrl?: string;
  duration?: number;
}

type NowPlayingListener = (snapshot: NowPlayingSnapshot | undefined) => void;

const nowPlaying = new Map<string, NowPlayingSnapshot>();
// Active streaming sources per src. A file only appears as "playing" while at
// least one source currently streams it, so a paused element (e.g. a row whose
// audio was stopped when the full-screen player took over) never un-highlights
// a file another element is still playing.
const activeSources = new Map<string, Set<string>>();
const listeners = new Map<string, Set<NowPlayingListener>>();

function notify(src: string, snapshot: NowPlayingSnapshot | undefined) {
  listeners.get(src)?.forEach((listener) => listener(snapshot));
}

export function reportNowPlaying(snapshot: NowPlayingSnapshot, sourceKey = '') {
  if (!snapshot?.src) return;
  const src = snapshot.src;

  let sources = activeSources.get(src);
  if (!sources) {
    sources = new Set();
    activeSources.set(src, sources);
  }
  if (snapshot.isPlaying) {
    sources.add(sourceKey);
  } else {
    sources.delete(sourceKey);
  }
  const isPlaying = sources.size > 0;

  const next: NowPlayingSnapshot = { ...snapshot, isPlaying };
  nowPlaying.set(src, next);

  // Notify on every report (including time updates) so subscribers like the
  // rows can mirror the streaming source's live progress/position.
  notify(src, next);
}

export function clearNowPlaying(src: string) {
  activeSources.delete(src);
  if (!nowPlaying.delete(src)) return;
  notify(src, undefined);
}

export function getNowPlaying(src: string): NowPlayingSnapshot | undefined {
  return nowPlaying.get(src);
}

export function subscribeNowPlaying(src: string, listener: NowPlayingListener): () => void {
  listener(nowPlaying.get(src));

  let set = listeners.get(src);
  if (!set) {
    set = new Set();
    listeners.set(src, set);
  }
  set.add(listener);

  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(src);
  };
}