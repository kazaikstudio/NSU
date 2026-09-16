export interface PlayerTrack {
  id: string;
  title: string;
  artist?: string;
  src: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileName?: string;
  playCount?: number;
  downloadCount?: number;
}

export function playerTrackFor(
  id: string,
  title: string,
  src: string,
  options: {
    artist?: string;
    thumbnailUrl?: string;
    fileUrl?: string;
    fileName?: string;
    playCount?: number;
    downloadCount?: number;
  } = {},
): PlayerTrack {
  return {
    id,
    title: title || 'Untitled Track',
    artist: options.artist,
    src,
    thumbnailUrl: options.thumbnailUrl || '/noll.jpg',
    fileUrl: options.fileUrl,
    fileName: options.fileName,
    playCount: typeof options.playCount === 'number' ? options.playCount : undefined,
    downloadCount: typeof options.downloadCount === 'number' ? options.downloadCount : undefined,
  };
}

export interface PlayerOpenPayload {
  track: PlayerTrack;
  queue?: PlayerTrack[];
  queueIndex?: number;
}

type PlayerListener = (payload: PlayerOpenPayload | null) => void;
type PlaybackToggleListener = (src: string) => void;

let currentPayload: PlayerOpenPayload | null = null;
const listeners = new Set<PlayerListener>();
const toggleListeners = new Set<PlaybackToggleListener>();

export function openAudioPlayer(payload: PlayerOpenPayload) {
  currentPayload = payload;
  listeners.forEach((listener) => listener(currentPayload));
}

export function closeAudioPlayer() {
  currentPayload = null;
  listeners.forEach((listener) => listener(currentPayload));
}

export function subscribeAudioPlayer(listener: PlayerListener) {
  listeners.add(listener);
  if (currentPayload) listener(currentPayload);
  return () => {
    listeners.delete(listener);
  };
}

export function requestPlaybackToggle(src: string) {
  toggleListeners.forEach((listener) => listener(src));
}

export function subscribePlaybackToggle(listener: PlaybackToggleListener) {
  toggleListeners.add(listener);
  return () => {
    toggleListeners.delete(listener);
  };
}