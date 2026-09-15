export interface PlaybackEntry {
  title: string;
  play: () => void;
  prime?: () => void;
}

const registry: PlaybackEntry[] = [];

export function registerPlaybackEntry(entry: PlaybackEntry) {
  if (registry.includes(entry)) return;
  registry.push(entry);
}

export function unregisterPlaybackEntry(entry: PlaybackEntry) {
  const index = registry.indexOf(entry);
  if (index !== -1) registry.splice(index, 1);
}

export function playNextAfter(entry: PlaybackEntry) {
  const index = registry.indexOf(entry);
  if (index === -1) return;
  const next = registry[index + 1];
  next?.play();
}

export function primeNextAfter(entry: PlaybackEntry) {
  const index = registry.indexOf(entry);
  if (index === -1) return;
  const next = registry[index + 1];
  next?.prime?.();
}