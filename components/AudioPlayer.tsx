'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, Download, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { closeAudioPlayer, requestPlaybackToggle, subscribeAudioPlayer, subscribePlaybackToggle, type PlayerOpenPayload, type PlayerTrack } from '@/lib/audio-player';
import { clearNowPlaying, getNowPlaying, reportNowPlaying, subscribeNowPlaying } from '@/lib/audio-now-playing';
import { reportTrackCounts, subscribeTrackCounts } from '@/lib/audio-counts';
import { downloadTrackFile } from '@/lib/download-track';
import { buildAudioDownloadName } from '@/lib/download';
import { extractStoredFileId, recordTrackPlay } from '@/lib/media-url';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Return the raw <src> string used to key the now-playing registry, so rows
// (which subscribe with the un-resolved prop) and this player always agree on
// the same key. Reading audio.src would resolve relative paths into absolute
// URLs and break the match.
function getStreamSrc(audio: HTMLAudioElement | null) {
  return audio?.getAttribute('data-src') || audio?.src || '';
}

export function extractFileId(src: string) {
  if (!src) return null;

  const directMatch = extractStoredFileId(src);
  if (directMatch) return directMatch;

  const fallbackMatch = src.match(/[?&]id=([^&]+)/i);
  if (!fallbackMatch?.[1]) return null;

  try {
    return decodeURIComponent(fallbackMatch[1]);
  } catch {
    return fallbackMatch[1];
  }
}

export function getMetricLabel(metric: 'plays' | 'downloads', count: number) {
  const normalized = Number.isFinite(count) ? count : 0;
  if (metric === 'downloads') {
    return normalized === 1 ? 'Download' : 'Downloads';
  }
  return normalized === 1 ? 'Play' : 'Plays';
}

function buildDownloadUrl(src: string, title: string, artist?: string) {
  const fileId = extractFileId(src);
  if (!fileId) return undefined;

  const params = new URLSearchParams({
    download: '1',
    filename: buildAudioDownloadName(title, artist),
    title,
  });
  if (artist) params.set('artist', artist);
  return `/api/dashboard/media/${encodeURIComponent(fileId)}?${params.toString()}`;
}

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const payloadRef = useRef<PlayerOpenPayload | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const indexRef = useRef(0);
  const trackRef = useRef<PlayerTrack | null>(null);
  const resumeTimeRef = useRef(0);
  const sourceKey = useId();

  const [payload, setPayload] = useState<PlayerOpenPayload | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [registryPlaying, setRegistryPlaying] = useState(false);
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [playCount, setPlayCount] = useState<number | null>(null);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  useEffect(() => {
    return subscribeAudioPlayer((next) => {
      payloadRef.current = next;
      setPayload(next);
    });
  }, []);

  const syncTrackCounts = useCallback(async (target: PlayerTrack | null) => {
    if (!target) return;

    const fileId = extractFileId(target.src);
    const fallbackPlayCount = typeof target.playCount === 'number' ? Number(target.playCount) : null;
    const fallbackDownloadCount = typeof target.downloadCount === 'number' ? Number(target.downloadCount) : null;

    if (!fileId) {
      setPlayCount(fallbackPlayCount);
      setDownloadCount(fallbackDownloadCount);
      return;
    }

    try {
      const res = await fetch(`/api/dashboard/media/${encodeURIComponent(fileId)}/play`, { cache: 'no-store' });
      if (!res.ok) {
        setPlayCount(fallbackPlayCount);
        setDownloadCount(fallbackDownloadCount);
        return;
      }

      const data = await res.json();
      const nextPlay = typeof data.trackPlays === 'number' ? Number(data.trackPlays) : fallbackPlayCount;
      const nextDownload = typeof data.trackDownloads === 'number' ? Number(data.trackDownloads) : fallbackDownloadCount;
      setPlayCount(nextPlay);
      setDownloadCount(nextDownload);
      // Refresh the shared registry too, so rows/cards showing this file jump
      // to the server's latest numbers the moment the player is opened.
      reportTrackCounts({
        src: target.src,
        ...(nextPlay != null ? { playCount: nextPlay } : {}),
        ...(nextDownload != null ? { downloadCount: nextDownload } : {}),
      });
    } catch {
      setPlayCount(fallbackPlayCount);
      setDownloadCount(fallbackDownloadCount);
    }
  }, []);

  // Mirror live counts from the shared registry so the player always matches
  // the numbers every other surface is showing for the same file.
  useEffect(() => {
    if (!track) return;
    return subscribeTrackCounts(track.src, (snapshot) => {
      if (typeof snapshot.playCount === 'number') setPlayCount(snapshot.playCount);
      if (typeof snapshot.downloadCount === 'number') setDownloadCount(snapshot.downloadCount);
    });
  }, [track]);

  const playTrack = useCallback((target: PlayerTrack, resumeTime = 0) => {
    const audio = audioRef.current;
    if (!audio) return;
    trackRef.current = target;
    setCurrentTime(0);
    setIsSeeking(false);
    setScrubTime(0);

    const sameSrc = audio.getAttribute('data-src') === target.src;
    // When replaying a file that is already loaded, loadedmetadata won't fire
    // again, so keep the existing duration instead of wiping it to 0.
    if (!sameSrc) {
      setDuration(0);
    }

    // Store the resume position so loadedmetadata can apply it reliably even
    // if the browser ignores currentTime before enough data is buffered.
    resumeTimeRef.current = Number.isFinite(resumeTime) && resumeTime > 0 ? resumeTime : 0;

    if (sameSrc) {
      if (resumeTimeRef.current > 0) {
        try { audio.currentTime = resumeTimeRef.current; } catch {}
      }
      void audio.play().catch(() => {});
    } else {
      // Stop flagging the previously streamed file so its rows/highlights clear.
      const prevSrc = audio.getAttribute('data-src');
      if (prevSrc && prevSrc !== target.src) clearNowPlaying(prevSrc);
      audio.src = target.src;
      audio.setAttribute('data-src', target.src);
      void audio.play().catch(() => {});
    }
    setIsPlaying(true);
  }, []);

  const playAt = useCallback((index: number, list = queueRef.current) => {
    const bounded = Math.max(0, Math.min(index, list.length - 1));
    const target = list[bounded];
    if (!target) return;
    indexRef.current = bounded;
    setQueueIndex(bounded);
    setTrack(target);
    void syncTrackCounts(target);
    playTrack(target);
  }, [playTrack, syncTrackCounts]);

  const handleOpen = useCallback((next: PlayerOpenPayload | null) => {
    payloadRef.current = next;
    setPayload(next);
    if (!next) return;

    const nextQueue = next.queue ?? [next.track];

    // Locate the clicked track in the queue for navigation state. Always play
    // next.track itself so the player never plays a different file.
    const matchedIndex = next.track
      ? nextQueue.findIndex((entry) => entry.id === next.track.id || entry.src === next.track.src)
      : -1;
    const navIndex = nextQueue.length === 0
      ? 0
      : matchedIndex >= 0
        ? matchedIndex
        : Math.max(0, Math.min(next.queueIndex ?? 0, nextQueue.length - 1));

    queueRef.current = nextQueue;
    indexRef.current = navIndex;
    trackRef.current = next.track;

    setQueue(nextQueue);
    setQueueIndex(navIndex);
    setTrack(next.track);
    setCurrentTime(0);
    setDuration(0);
    setPlayCount(typeof next.track.playCount === 'number' ? Number(next.track.playCount) : null);
    setDownloadCount(typeof next.track.downloadCount === 'number' ? Number(next.track.downloadCount) : null);
    void syncTrackCounts(next.track);

    const snapshot = getNowPlaying(next.track.src);
    const audio = audioRef.current;
    const alreadyOnThisTrack = audio && audio.getAttribute('data-src') === next.track.src && audio.src;

    // If this exact file is already loaded and currently paused everywhere,
    // reopen in place (paused) instead of forcing playback, so a pause made on
    // a row or this player is respected across minimize/open.
    if (alreadyOnThisTrack && snapshot && !snapshot.isPlaying) {
      setCurrentTime(snapshot.currentTime ?? audio.currentTime);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      setIsPlaying(false);
      return;
    }

    const resumeTime = snapshot?.isPlaying ? snapshot.currentTime : 0;
    playTrack(next.track, resumeTime);
  }, [playTrack, syncTrackCounts]);

  useEffect(() => {
    return subscribeAudioPlayer(handleOpen);
  }, [handleOpen]);

  // Mirror the shared now-playing registry for the current track so the central
  // play/pause button reflects playback started from any element, not just this
  // player's own <audio>. The subscription's initial callback seeds the value,
  // so no synchronous setState is needed here.
  useEffect(() => {
    if (!track) return;
    return subscribeNowPlaying(track.src, (snapshot) => {
      setRegistryPlaying(snapshot?.isPlaying ?? false);
    });
  }, [track]);

  const pickShuffleIndex = () => {
    const len = queueRef.current.length;
    if (len <= 1) return 0;
    let next = indexRef.current;
    while (next === indexRef.current) {
      next = Math.floor(Math.random() * len);
    }
    return next;
  };

  const handleEnded = () => {
    if (repeatMode === 'one') {
      playAt(indexRef.current);
      return;
    }
    if (queueIndex < queue.length - 1) {
      playAt(queueIndex + 1);
    } else if (repeatMode === 'all' && queue.length > 0) {
      playAt(0);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      const audio = audioRef.current;
      if (audio) {
        reportNowPlaying({
          src: getStreamSrc(audio),
          currentTime: 0,
          isPlaying: false,
          title: trackRef.current?.title || 'Untitled Track',
          artist: trackRef.current?.artist,
          thumbnailUrl: trackRef.current?.thumbnailUrl,
          duration: audio.duration,
        }, sourceKey);
      }
    }
  };

  const handlePrev = () => {
    if (currentTime > 3) {
      const audio = audioRef.current;
      if (audio) audio.currentTime = 0;
      return;
    }
    if (isShuffle && queue.length > 1) {
      playAt(pickShuffleIndex());
      return;
    }
    playAt(queueIndex - 1);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    if (isShuffle && queue.length > 1) {
      playAt(pickShuffleIndex());
      return;
    }
    if (queueIndex < queue.length - 1) {
      playAt(queueIndex + 1);
      return;
    }
    if (repeatMode === 'all') {
      playAt(0);
    }
  };

  const handleToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  const handleToggleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    // Behave exactly like a row's play/pause: if the track is streaming from
    // this element or any other source, route the toggle through the shared
    // registry path so every control (rows + this button) stays in sync.
    if (!audio.paused || registryPlaying) {
      requestPlaybackToggle(track.src);
      return;
    }

    recordTrackPlay(track.src);
    void audio.play().catch(() => {});
    setIsPlaying(true);
  };

  const handleClose = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      reportNowPlaying({
        src: getStreamSrc(audio),
        currentTime: audio.currentTime,
        isPlaying: !audio.paused,
        title: trackRef.current?.title || 'Untitled Track',
        artist: trackRef.current?.artist,
        thumbnailUrl: trackRef.current?.thumbnailUrl,
        duration: audio.duration,
      }, sourceKey);
    }
    closeAudioPlayer();
  }, [sourceKey]);

  useEffect(() => {
    if (!payload) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [payload, handleClose]);

  // Pause this player when another audio element starts playing.
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const audio = audioRef.current;
      if (audio && e.target !== audio && !audio.paused) {
        audio.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('play', handleGlobalPlay, true);
    return () => window.removeEventListener('play', handleGlobalPlay, true);
  }, []);

  // Let rows toggle this player's playback for the file they represent, so the
  // row's play button stays in sync as the active control for a playing file.
  useEffect(() => {
    return subscribePlaybackToggle((src) => {
      const audio = audioRef.current;
      if (!audio) return;
      // If the toggle is for a track other than the one currently loaded, switch
      // to it instead of ignoring the request, so every row's play/pause button
      // stays a reliable toggle for the file it represents.
      if (trackRef.current?.src !== src) {
        const index = queueRef.current.findIndex((entry) => entry.src === src);
        if (index !== -1) playAt(index);
        return;
      }
      if (audio.paused) {
        void audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
  }, [playAt]);

  const isOpen = !!payload && !!track;
  const downloadUrl = isOpen && track ? buildDownloadUrl(track.src, track.title, track.artist) : '';
  const hasMultipleTracks = isOpen ? queue.length > 1 : false;
  const isEffectivelyPlaying = isPlaying || registryPlaying;

  return (
          <>
            <audio
              ref={audioRef}
              preload="none"
              className="hidden"
              onPlay={() => {
                const currentSrc = trackRef.current?.src || '';
                if (currentSrc) {
                  setPlayCount((current) => {
                    const base = current ?? 0;
                    return Number.isFinite(base) ? base + 1 : 1;
                  });
                  recordTrackPlay(currentSrc);
                  void fetch(`/api/dashboard/media/${encodeURIComponent(extractFileId(currentSrc) || '')}/play`, { cache: 'no-store' })
                    .then((res) => res.ok ? res.json() : null)
                    .then((data) => {
                      if (!data || typeof data.trackPlays !== 'number') return;
                      setPlayCount(Number(data.trackPlays));
                    })
                    .catch(() => {});
                }
                setIsPlaying(true);
                const audio = audioRef.current;
                if (audio) {
                  reportNowPlaying({
                    src: getStreamSrc(audio),
                    currentTime: audio.currentTime,
                    isPlaying: true,
                    title: trackRef.current?.title || 'Untitled Track',
                    artist: trackRef.current?.artist,
                    thumbnailUrl: trackRef.current?.thumbnailUrl,
                    duration: audio.duration,
                  }, sourceKey);
                }
              }}
              onPause={() => {
                setIsPlaying(false);
                const audio = audioRef.current;
                if (audio) {
                  reportNowPlaying({
                    src: getStreamSrc(audio),
                    currentTime: audio.currentTime,
                    isPlaying: false,
                    title: trackRef.current?.title || 'Untitled Track',
                    artist: trackRef.current?.artist,
                    thumbnailUrl: trackRef.current?.thumbnailUrl,
                    duration: audio.duration,
                  }, sourceKey);
                }
              }}
              onTimeUpdate={() => {
                const audio = audioRef.current;
                if (!audio) return;
                const nextTime = audio.currentTime;
                if (!isSeeking) setCurrentTime(nextTime);
                reportNowPlaying({
                  src: getStreamSrc(audio),
                  currentTime: nextTime,
                  isPlaying: !audio.paused,
                  title: trackRef.current?.title || 'Untitled Track',
                  artist: trackRef.current?.artist,
                  thumbnailUrl: trackRef.current?.thumbnailUrl,
                  duration: audio.duration,
                }, sourceKey);
              }}
              onLoadedMetadata={() => {
                const audio = audioRef.current;
                if (!audio || !Number.isFinite(audio.duration)) return;
                setDuration(audio.duration);
                if (resumeTimeRef.current > 0) {
                  try {
                    if (audio.currentTime < resumeTimeRef.current) {
                      audio.currentTime = resumeTimeRef.current;
                    }
                  } catch {}
                  resumeTimeRef.current = 0;
                }
              }}
              onEnded={handleEnded}
            />

            {payload && track ? (
              <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#090a0f]">
                {/* Background Blurred Cover */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={track.thumbnailUrl || '/noll.jpg'}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15 blur-3xl scale-110"
                />

                {/* Modern Atmospheric Glow Orbs */}
                <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-120 w-120 rounded-full bg-cyan-500/10 blur-[120px]" />
                <div aria-hidden className="pointer-events-none absolute top-1/4 -right-32 h-128 w-lg rounded-full bg-purple-600/15 blur-[140px]" />
                <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/3 h-112 w-md rounded-full bg-blue-600/10 blur-[120px]" />

                {/* Main Container */}
                <div className="relative flex h-full w-full flex-col overflow-hidden border border-white/8 bg-[#0b0e13]/80 px-5 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:px-8">
                  <div className="mx-auto flex min-h-0 w-full max-w-90 flex-1 flex-col">
                    {/* Top Navigation Bar */}
                    <div className="flex shrink-0 items-center justify-between w-full">
                      <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close full screen player"
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/80 transition-all hover:scale-[1.02] hover:bg-white/10 hover:text-white active:scale-95"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1.5 backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                        <span className="text-[10px] font-medium tracking-[0.18em] text-white/80 uppercase">Playing</span>
                      </div>

                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          download={buildAudioDownloadName(track.title, track.artist)}
                          onClick={(event) => {
                            event.preventDefault();
                            void downloadTrackFile({
                              url: downloadUrl,
                              title: track.title,
                              artist: track.artist,
                              src: track.src,
                            });
                          }}
                          aria-label="Download track"
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 transition-all hover:scale-[1.02] hover:bg-cyan-500/15 active:scale-95"
                        >
                          <Download className="h-5 w-5" />
                        </a>
                      ) : (
                        <div className="h-11 w-11" />
                      )}
                    </div>

                    {/* Center Album Art & Info */}
                    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                      <div className="my-auto flex flex-col items-center pt-6">
                      <div className="relative aspect-square w-full overflow-hidden rounded-4xl border border-white/10 bg-[#111827] shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-white/5">
                        <Image
                          fill
                          unoptimized
                          src={track.thumbnailUrl || '/noll.jpg'}
                          alt={track.title}
                          sizes="360px"
                          className="object-cover transition-transform duration-700 hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
                      </div>

                      <div className="mt-7 w-full text-left">
                        <h2 className="truncate text-[1.7rem] font-black tracking-tighter text-white sm:text-[2rem]">{track.title || 'Untitled Track'}</h2>
                        <p className="mt-1.5 truncate text-sm font-medium text-white/45">{track.artist || 'Audio Track'}</p>
                      </div>

                      <div className="mt-4 flex w-full items-center justify-center gap-7 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-base font-bold text-white">
                            {(downloadCount ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-medium tracking-[0.12em] text-white/45 uppercase">
                            {getMetricLabel('downloads', downloadCount ?? 0)}
                          </span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-base font-bold text-white">
                            {(playCount ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-medium tracking-[0.12em] text-white/45 uppercase">
                            {getMetricLabel('plays', playCount ?? 0)}
                          </span>
                        </div>
                      </div>

                      {/* Range Slider / Progress Bar with Dynamic Playing Progress Fill & Fully Rounded Thumb */}
                      <div className="mt-7 w-full">
                        <div className="relative flex items-center">
                          <input
                            type="range"
                            min={0}
                            max={duration > 0 ? duration : 0}
                            step={0.1}
                            value={isSeeking ? scrubTime : Math.min(currentTime, duration)}
                            onChange={(e) => {
                              setScrubTime(Number(e.target.value));
                              setIsSeeking(true);
                            }}
                            onPointerDown={() => setIsSeeking(true)}
                            onPointerUp={() => {
                              const audio = audioRef.current;
                              if (audio && Number.isFinite(scrubTime)) audio.currentTime = scrubTime;
                              setCurrentTime(scrubTime);
                              setIsSeeking(false);
                              reportNowPlaying({
                                src: getStreamSrc(audio),
                                currentTime: scrubTime,
                                isPlaying: audio ? !audio.paused : false,
                                title: trackRef.current?.title || 'Untitled Track',
                                artist: trackRef.current?.artist,
                                thumbnailUrl: trackRef.current?.thumbnailUrl,
                                duration: audio?.duration,
                              }, sourceKey);
                            }}
                            style={{
                              background: `linear-gradient(to right, rgb(34 211 238) ${((isSeeking ? scrubTime : currentTime) / (duration > 0 ? duration : 1)) * 100}%, rgba(255, 255, 255, 0.12) ${((isSeeking ? scrubTime : currentTime) / (duration > 0 ? duration : 1)) * 100}%)`
                            }}
                            aria-label="Seek"
                            className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none transition-all
                              [&::-webkit-slider-thumb]:appearance-none
                              [&::-webkit-slider-thumb]:w-4
                              [&::-webkit-slider-thumb]:h-4
                              [&::-webkit-slider-thumb]:rounded-full
                              [&::-webkit-slider-thumb]:bg-cyan-400
                              [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(34,211,238,0.8)]
                              [&::-webkit-slider-thumb]:transition-transform
                              [&::-webkit-slider-thumb]:hover:scale-125
                              [&::-moz-range-thumb]:w-4
                              [&::-moz-range-thumb]:h-4
                              [&::-moz-range-thumb]:rounded-full
                              [&::-moz-range-thumb]:bg-cyan-400
                              [&::-moz-range-thumb]:border-0
                              [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                          />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-[11px] font-medium text-white/40">
                          <span>{formatTime(isSeeking ? scrubTime : currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>
                    </div>
                    </div>

                    {/* Bottom Control Buttons */}
                    <div className="mt-8 mb-2 flex shrink-0 items-center justify-between w-full mx-auto">
                      <button
                        type="button"
                        onClick={handleToggleShuffle}
                        aria-label={isShuffle ? 'Shuffle on' : 'Shuffle off'}
                        aria-pressed={isShuffle}
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${isShuffle ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-400/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                      >
                        <Shuffle className="h-5 w-5" />
                      </button>

                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={!hasMultipleTracks}
                        aria-label="Previous track"
                        className="flex h-11 w-11 items-center justify-center text-white/80 transition-all hover:text-white disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                      >
                        <SkipBack className="h-6 w-6 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={handleTogglePlay}
                        aria-label={isEffectivelyPlaying ? 'Pause' : 'Play'}
                        className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-tr from-cyan-400 via-sky-500 to-blue-600 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.5)] transition-all hover:scale-105 hover:shadow-[0_0_36px_rgba(34,211,238,0.7)] active:scale-95"
                      >
                        {isEffectivelyPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current ml-1" />}
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={!hasMultipleTracks}
                        aria-label="Next track"
                        className="flex h-11 w-11 items-center justify-center text-white/80 transition-all hover:text-white disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                      >
                        <SkipForward className="h-6 w-6 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleRepeat}
                        aria-label={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${repeatMode !== 'off' ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-400/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
                      >
                        {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        );
}
