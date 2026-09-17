'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import { getTrackCounts, subscribeTrackCounts, type TrackCountsSnapshot } from '@/lib/audio-counts';
import { downloadTrackFile } from '@/lib/download-track';
import { readCachedData, writeCachedData } from '@/lib/client-cache';
import { playNextAfter, primeNextAfter, registerPlaybackEntry, unregisterPlaybackEntry, type PlaybackEntry } from '@/lib/audio-playback';
import { primeAudioStart } from '@/lib/audio-preload';
import { openAudioPlayer, requestPlaybackToggle, type PlayerTrack } from '@/lib/audio-player';
import { clearNowPlaying, getNowPlaying, reportNowPlaying, subscribeNowPlaying, type NowPlayingSnapshot } from '@/lib/audio-now-playing';
import { recordTrackPlay } from '@/lib/media-url';

interface DownloadCountUpdate {
  trackDownloads?: number;
  artistTotalDownloads?: number;
}

interface AudioRowProps {
  src: string;
  title: string;
  fileUrl?: string;
  album?: string | null;
  resolution?: string;
  fileName?: string;
  createdAt?: string;
  artistName?: string;
  featuredArtistName?: string | null;
  artistGenre?: string | null;
  downloadCount?: number;
  playCount?: number;
  showDownload?: boolean;
  thumbnailUrl?: string;
  onPlay?: () => void;
  onDownload?: (countUpdate?: DownloadCountUpdate) => void;
  onNext?: () => void;
  playerQueue?: PlayerTrack[];
  playerQueueIndex?: number;
  // When set, the row does not own an <audio> element — clicks play through
  // the parent (e.g. the full-screen player's audio) instead. This keeps the
  // exact same row visuals/behaviour inside the player's track list.
  delegatedPlay?: () => void;
  progress?: number;
}

function getDownloadUrl(fileUrl: string | undefined, fileName: string | undefined, title: string, artistName?: string) {
  if (!fileUrl) return undefined;

  const match = fileUrl.match(/\/api\/dashboard\/media\/([^?]+)|\/media\/([^?]+)|[?&]id=([^&]+)/i);
  const fileId = match?.[1] || match?.[2] || match?.[3];
  if (!fileId) return fileUrl;

  const params = new URLSearchParams({
    download: '1',
    filename: fileName || `${title}.mp3`,
    title,
  });
  if (artistName) params.set('artist', artistName);
  return `/api/dashboard/media/${fileId}?${params.toString()}`;
}

interface AudioCacheEntry {
  currentTime: number;
  wasPlaying: boolean;
}

function audioCacheKey(src: string) {
  return `audio-row:${src}`;
}

const audioCache = new Map<string, AudioCacheEntry>();

function getAudioCacheEntry(src: string): AudioCacheEntry | undefined {
  const cached = audioCache.get(src);
  if (cached) return cached;

  const restored = readCachedData<AudioCacheEntry>(audioCacheKey(src));
  if (restored == null) {
    audioCache.delete(src);
    return undefined;
  }
  audioCache.set(src, restored);
  return restored;
}

function saveAudioCacheEntry(src: string, entry: AudioCacheEntry) {
  audioCache.set(src, entry);
  writeCachedData(audioCacheKey(src), entry);
}

export default function AudioRow({
  src,
  title,
  fileUrl,
  fileName,
  artistName,
  featuredArtistName,
  thumbnailUrl,
  downloadCount,
  playCount,
  showDownload = true,
  onPlay,
  onDownload,
  playerQueue,
  playerQueueIndex = 0,
  delegatedPlay,
  progress,
}: AudioRowProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const sourceKey = useId();
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isPlaying, setIsPlaying] = useState(() => {
    const cached = getAudioCacheEntry(src);
    return cached?.wasPlaying ?? false;
  });
  const [registrySnapshot, setRegistrySnapshot] = useState<NowPlayingSnapshot | undefined>(() => getNowPlaying(src));
  const [liveCounts, setLiveCounts] = useState<TrackCountsSnapshot | undefined>(() => getTrackCounts(src));
  const [isExpanded, setIsExpanded] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const downloadTimerRef = useRef<number | null>(null);
  const downloadProgressRef = useRef(0);
  const lastPersistRef = useRef(0);
  const playbackEntryRef = useRef<PlaybackEntry>({ title: '', play: () => {} });

  if (currentSrc !== src) {
    setCurrentSrc(src);
    setPlayProgress(0);
    setIsPlaying(getAudioCacheEntry(src)?.wasPlaying ?? false);
    setRegistrySnapshot(getNowPlaying(src));
    setLiveCounts(getTrackCounts(src));
    setIsExpanded(false);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.load();
    const cached = getAudioCacheEntry(src);
    if (cached) {
      audio.currentTime = cached.currentTime;
      if (cached.wasPlaying) {
        audio.play().catch(() => {});
      }
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        window.clearTimeout(downloadTimerRef.current);
      }
      if (downloadProgressRef.current) {
        downloadProgressRef.current = 0;
      }
    };
  }, []);

  // Pause this player when another audio element starts playing
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const audio = audioRef.current;
      if (audio && e.target !== audio) {
        audio.pause();
        setIsPlaying(false);
        setIsExpanded(false);
      }
    };

    window.addEventListener('play', handleGlobalPlay, true);
    return () => {
      window.removeEventListener('play', handleGlobalPlay, true);
    };
  }, []);

  // Mirror the shared now-playing registry so this row keeps showing as the
  // active/playing row even when another element (e.g. the full-screen player)
  // is streaming the same file and has paused this row's own audio element.
  useEffect(() => {
    return subscribeNowPlaying(src, (snapshot) => {
      setRegistrySnapshot(snapshot);
    });
  }, [src]);

  // Mirror the shared counts registry so this row always shows the latest live
  // play/download numbers, no matter where playback or a download happened.
  useEffect(() => {
    return subscribeTrackCounts(src, (snapshot) => {
      setLiveCounts(snapshot);
    });
  }, [src]);

  // Start buffering this track early so clicking play starts almost instantly.
  const primeAudio = () => {
    if (delegatedPlay) return;
    primeAudioStart(src, audioRef.current);
  };

  // Keep the auto-play queue entry in sync with this row's current title/play.
  useEffect(() => {
    playbackEntryRef.current.title = title;
    playbackEntryRef.current.prime = primeAudio;
    playbackEntryRef.current.play = () => {
      const node = audioRef.current;
      if (!node || !node.paused) return;
      node.play().catch(() => {});
    };
  });

  // Register this row so a finished track advances to the next one.
  useEffect(() => {
    const entry = playbackEntryRef.current;
    registerPlaybackEntry(entry);
    return () => unregisterPlaybackEntry(entry);
  }, []);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Row rendered inside the full-screen player: playback is delegated to the
    // player's audio element, so toggle that source instead of this row's own.
    if (delegatedPlay) {
      if (registryPlaying) {
        requestPlaybackToggle(src);
      } else {
        delegatedPlay();
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    // If this row's own element is already producing sound, pause it.
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      saveAudioCacheEntry(src, { currentTime: audio.currentTime, wasPlaying: false });
      return;
    }

    // The actual file is streaming somewhere else (e.g. the full-screen player),
    // so toggle that source instead of starting a duplicate playback.
    if (registryPlaying) {
      requestPlaybackToggle(src);
      return;
    }

    try {
      recordTrackPlay(src);
      await audio.play();
      setIsPlaying(true);
      setIsExpanded(true);
      saveAudioCacheEntry(src, { currentTime: audio.currentTime, wasPlaying: true });
    } catch (err) {
      // AbortError is expected when playback is superseded by another track
      // or a preload reset — not a real failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Play failed:', err);
    }
  };

  const handleRowClick = async () => {
    setIsExpanded(true);

    if (delegatedPlay) {
      // Inside the full-screen player, row click behaves exactly like the page
      // rows: if this file is currently playing, toggle (pause) the streaming
      // source; otherwise switch the player to this track.
      if (registryPlaying) {
        requestPlaybackToggle(src);
        return;
      }
      delegatedPlay();
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    // If this row's own element is already producing sound, pause it (toggle).
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      saveAudioCacheEntry(src, { currentTime: audio.currentTime, wasPlaying: false });
      return;
    }

    // If the file is streaming elsewhere (full-screen player), toggle that source
    // instead of starting a second playback here.
    if (registryPlaying) {
      requestPlaybackToggle(src);
      return;
    }

    try {
      recordTrackPlay(src);
      await audio.play();
      saveAudioCacheEntry(src, { currentTime: audio.currentTime, wasPlaying: true });
    } catch (err) {
      // AbortError is expected when playback is superseded by another track
      // or a preload reset — not a real failure.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Play failed:', err);
    }
  };

  const artistCredit = artistName
    ? featuredArtistName
      ? `${artistName} ft ${featuredArtistName}`
      : artistName
    : '';
  const downloadUrl = getDownloadUrl(fileUrl, fileName, title, artistCredit);
  const hasArtistDetails = Boolean(artistCredit);
  const registryPlaying = registrySnapshot?.isPlaying ?? false;
  // A row looks "playing" if its own <audio> is playing OR the shared registry
  // says this file is being streamed (e.g. by the full-screen player), which
  // keeps the clicked row highlighted even after the player closes.
  const isEffectivelyPlaying = isPlaying || registryPlaying;

  // Live counts from the shared registry override the (possibly stale) props so
  // the number on screen matches the global source of truth the moment a play
  // or download happens anywhere in the app.
  const effectivePlayCount = liveCounts?.playCount != null
    ? liveCounts.playCount
    : Number.isFinite(playCount) ? Number(playCount) : 0;
  const effectiveDownloadCount = liveCounts?.downloadCount != null
    ? liveCounts.downloadCount
    : Number.isFinite(downloadCount) ? Number(downloadCount) : 0;

  const handleDownloadClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!downloadUrl) return;

    if (downloadTimerRef.current) {
      window.clearTimeout(downloadTimerRef.current);
    }

    setDownloadStatus('downloading');
    downloadProgressRef.current = 8;

    const result = await downloadTrackFile({
      url: downloadUrl,
      title,
      artist: artistCredit || undefined,
      fileName: fileName || `${title}.mp3`,
      src,
      thumbnailUrl: thumbnailUrl || undefined,
      onStatus: (status, progress) => {
        setDownloadStatus(status);
        downloadProgressRef.current = progress;
        if (status === 'done' || status === 'error') {
          if (downloadTimerRef.current) {
            window.clearTimeout(downloadTimerRef.current);
          }
          downloadTimerRef.current = window.setTimeout(() => {
            setDownloadStatus('idle');
          }, status === 'done' ? 1800 : 2200);
        }
      },
    });

    if (result) {
      onDownload?.({
        trackDownloads: result.trackDownloads,
        artistTotalDownloads: result.artistTotalDownloads,
      });
    }
  };

  const audioTag = delegatedPlay ? null : (
    <audio
      ref={audioRef}
      preload="none"
      src={src}
onPlay={() => {
          setIsPlaying(true);
          const audio = audioRef.current;
          if (audio) saveAudioCacheEntry(src, { currentTime: audio.currentTime, wasPlaying: true });
          reportNowPlaying({
            src,
            currentTime: audio?.currentTime ?? 0,
            isPlaying: true,
            title,
            artist: artistCredit || undefined,
            thumbnailUrl,
            duration: audio?.duration,
          }, sourceKey);
          primeNextAfter(playbackEntryRef.current);
          onPlay?.();
        }}
        onPause={() => {
          setIsPlaying(false);
          const audio = audioRef.current;
          if (audio) saveAudioCacheEntry(src, { currentTime: audio.currentTime, wasPlaying: false });
          reportNowPlaying({
            src,
            currentTime: audio?.currentTime ?? 0,
            isPlaying: false,
            title,
            artist: artistCredit || undefined,
            thumbnailUrl,
            duration: audio?.duration,
          }, sourceKey);
        }}
      onTimeUpdate={() => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextTime = audio.currentTime;
        if (isFinite(audio.duration) && audio.duration > 0) {
          setPlayProgress((nextTime / audio.duration) * 100);
        }
        reportNowPlaying({
          src,
          currentTime: nextTime,
          isPlaying: !audio.paused,
          title,
          artist: artistCredit || undefined,
          thumbnailUrl,
          duration: audio.duration,
        }, sourceKey);
        const now = Date.now();
        if (now - lastPersistRef.current >= 1000) {
          lastPersistRef.current = now;
          saveAudioCacheEntry(src, { currentTime: nextTime, wasPlaying: !audio.paused });
        } else {
          audioCache.set(src, { currentTime: nextTime, wasPlaying: !audio.paused });
        }
      }}
      onEnded={() => {
        setIsPlaying(false);
        setPlayProgress(0);
        audioCache.delete(src);
        writeCachedData(audioCacheKey(src), null);
        clearNowPlaying(src);
        playNextAfter(playbackEntryRef.current);
      }}
      className="sr-only"
      aria-label={`Audio player for ${title}`}
    />
  );

  const playButton = (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={isEffectivelyPlaying ? 'Pause track' : 'Play track'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white transition-all duration-200 hover:bg-amber-300 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer ${
        isEffectivelyPlaying ? 'shadow-lg shadow-amber-400/50' : 'shadow-md shadow-amber-400/20'
      }`}
    >
      {isEffectivelyPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
    </button>
  );

  if (!hasArtistDetails) {
    return (
      <div onClick={handleRowClick} onPointerEnter={primeAudio} onFocus={primeAudio} className="cursor-pointer">
        {audioTag}
        {isExpanded || isEffectivelyPlaying ? playButton : <div className="text-Eltext1 text-sm font-semibold truncate">{title}</div>}
      </div>
    );
  }

  // Progress bar stays live no matter who is streaming the file: the row's own
  // <audio> (playProgress) or another source like the full-screen player
  // (registry snapshot fed through the `progress` prop in the player).
  const registryProgress =
    registrySnapshot?.duration && registrySnapshot.duration > 0
      ? Math.min(100, (registrySnapshot.currentTime / registrySnapshot.duration) * 100)
      : 0;
  const progressBarVisible = isEffectivelyPlaying;
  const progressBarValue = delegatedPlay ? (progress ?? 0) : isPlaying ? playProgress : registryProgress;

  return (
    <article
      onClick={handleRowClick}
      onPointerEnter={primeAudio}
      onFocus={primeAudio}
      className="group relative flex min-w-0 items-center gap-3 sm:gap-3 px-3 py-2.5 transition cursor-pointer text-Eltext1 sm:px-4 sm:py-3 bg-cardcl/40 shadow-lg shadow-black/5"
      >
      {/* Active gradient overlay — fades left-to-right when playing */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-linear-to-r from-amber-400/20 to-transparent transition-opacity duration-300 group-hover:opacity-100 ${
          isEffectivelyPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {audioTag}

      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-3">
        <div className="shrink-0">
          <div
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-md overflow-hidden bg-mrow/60 flex items-center justify-center cursor-pointer group/thumb"
            onClick={(e) => {
              e.stopPropagation();
              // Inside the full-screen player, treat the thumbnail like the play
              // button so it switches/toggles the track without closing the player.
              if (delegatedPlay) {
                void togglePlay(e);
                return;
              }
              openAudioPlayer({
                track: {
                  id: src,
                  title,
                  artist: artistCredit || undefined,
                  src,
                  thumbnailUrl,
                  playCount: effectivePlayCount,
                  downloadCount: effectiveDownloadCount,
                },
                queue: playerQueue && playerQueue.length > 0 ? playerQueue : undefined,
                queueIndex: playerQueueIndex >= 0 ? playerQueueIndex : 0,
              });
            }}
            title={delegatedPlay ? 'Play track' : 'Open full screen player'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl || '/noll.jpg'}
              alt={thumbnailUrl ? title : 'Default music thumbnail'}
              onPointerEnter={primeAudio}
              onFocus={primeAudio}
              className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
            />
          </div>
        </div>

        {/* Title + artist + plays */}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="block min-w-0 truncate text-xs font-semibold text-Eltext1 sm:text-sm">
              {title}
            </span>
          </div>
          <span className="mt-0.5 block truncate text-[10px] text-secondry/60 sm:text-xs">
            {artistCredit}
          </span>
        </div>
      </div>

      {/* Play / Pause button */}
      {playButton}

      {/* Download button */}
      {showDownload && downloadUrl && (
        <a
          href={downloadUrl}
          download={fileName || `${title}.mp3`}
          onClick={handleDownloadClick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[11px] font-semibold text-Eltext1 transition hover:border-amber-300 hover:bg-amber-400/20 sm:px-3 cursor-pointer"
          aria-label={`Download ${title}`}
        >
          <Download size={14} />
          <span className="hidden sm:inline">
            {downloadStatus === 'downloading' ? 'Downloading…' : downloadStatus === 'done' ? 'Saved' : 'Download'}
          </span>
        </a>
      )}

      {/* Playback progress bar — bottom border style, visible while clicked & playing */}
      <div
        className={`absolute inset-x-0 bottom-0 h-0.5 bg-black/10 transition-opacity duration-300 ${
          progressBarVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="h-full bg-amber-400 transition-[width] duration-200 ease-linear"
          style={{ width: `${progressBarValue}%` }}
        />
      </div>
    </article>
  );
}
