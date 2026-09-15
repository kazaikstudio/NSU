'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, Download, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { closeAudioPlayer, requestPlaybackToggle, subscribeAudioPlayer, subscribePlaybackToggle, type PlayerOpenPayload, type PlayerTrack } from '@/lib/audio-player';
import { clearNowPlaying, getNowPlaying, reportNowPlaying, subscribeNowPlaying } from '@/lib/audio-now-playing';
import { buildAudioDownloadName } from '@/lib/download';

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

function extractFileId(src: string) {
  const match = src.match(/\/media\/([a-zA-Z0-9_-]+)(?:[/?#]|$)|[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] || match?.[2] || null;
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
  return `/api/dashboard/media/${fileId}?${params.toString()}`;
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
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  useEffect(() => {
    return subscribeAudioPlayer((next) => {
      payloadRef.current = next;
      setPayload(next);
    });
  }, []);

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
    playTrack(target);
  }, [playTrack]);

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
    setDownloadCount(null);

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
  }, [playTrack]);

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

  // Fetch the download count for the current track from the database.
  useEffect(() => {
    const fileId = track ? extractFileId(track.src) : null;
    if (!track || !fileId) return;

    let cancelled = false;

    fetch(`/api/dashboard/media/${fileId}?play=1`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && typeof data.trackDownloads === 'number') {
          setDownloadCount(data.trackDownloads);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
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
                <div className="relative flex h-full w-full flex-col justify-between overflow-y-auto bg-[#0b0e14]/80 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-3xl px-6 py-8 sm:px-10 sm:py-10 scrollbar-none [&::-webkit-scrollbar]:hidden border border-white/6">

                  {/* Top Navigation Bar */}
                  <div className="flex items-center justify-between w-full">
                    <button
                      type="button"
                      onClick={handleClose}
                      aria-label="Close full screen player"
                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/4 border border-white/8 text-white/80 transition-all hover:bg-white/8 hover:text-white hover:scale-[1.02] active:scale-95 shadow-lg shadow-black/20"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/3 border border-white/6 backdrop-blur-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-medium text-white/90 tracking-wide uppercase">Playing Music</span>
                    </div>

                    {/* Requirement 1: Menu button changed to download icon button */}
                    {downloadUrl ? (
                      <a
                        href={downloadUrl}
                        download={buildAudioDownloadName(track.title, track.artist)}
                        aria-label="Download track"
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 transition-all hover:bg-cyan-500/20 hover:scale-[1.02] active:scale-95 shadow-lg shadow-cyan-950/30"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    ) : (
                      <div className="h-11 w-11" />
                    )}
                  </div>

                  {/* Center Album Art & Info */}
                  <div className="my-auto flex flex-col items-center py-4">
                    <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-4xl border border-white/8 shadow-[0_20px_50px_rgba(0,0,0,0.7)] bg-neutral-900 group">
                      <Image
                        fill
                        unoptimized
                        src={track.thumbnailUrl || '/noll.jpg'}
                        alt={track.title}
                        sizes="320px"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-60" />
                    </div>

                    {/* Track Info & Requirement 2: Love replaced with download counts */}
                    <div className="mt-8 w-full max-w-[320px] flex items-center justify-between px-1">
                      <div className="truncate text-left pr-3">
                        <h2 className="truncate text-xl font-bold text-white tracking-tight sm:text-2xl">{track.title || 'Untitled Track'}</h2>
                        <p className="mt-1.5 truncate text-sm font-medium text-white/40">{track.artist || 'Audio Track'}</p>
                      </div>

                      {/* Download counts displayed where the love icon was */}
                      {downloadCount !== null && (
                        <div className="flex flex-col items-end shrink-0 pl-2 py-1 px-3 rounded-xl bg-white/3 border border-white/6">
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {downloadCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-medium text-white/40 tracking-wider uppercase">
                            {downloadCount === 1 ? 'Download' : 'Downloads'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Range Slider / Progress Bar with Dynamic Playing Progress Fill & Fully Rounded Thumb */}
                    <div className="mt-7 w-full max-w-[320px]">
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
                            background: `linear-gradient(to right, rgb(6 182 212) ${((isSeeking ? scrubTime : currentTime) / (duration > 0 ? duration : 1)) * 100}%, rgba(255, 255, 255, 0.1) ${((isSeeking ? scrubTime : currentTime) / (duration > 0 ? duration : 1)) * 100}%)`
                          }}
                          aria-label="Seek"
                          className="w-full h-2 rounded-full appearance-none cursor-pointer focus:outline-none transition-all
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-4
                            [&::-webkit-slider-thumb]:h-4
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-cyan-400
                            [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(6,182,212,0.8)]
                            [&::-webkit-slider-thumb]:transition-transform
                            [&::-webkit-slider-thumb]:hover:scale-125
                            [&::-moz-range-thumb]:w-4
                            [&::-moz-range-thumb]:h-4
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-cyan-400
                            [&::-moz-range-thumb]:border-0
                            [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(6,182,212,0.8)]"
                        />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between text-xs font-mono text-white/40">
                        <span>{formatTime(isSeeking ? scrubTime : currentTime)}</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Control Buttons */}
                  <div className="mb-2 flex items-center justify-between w-full max-w-[320px] mx-auto px-2">
                    <button
                      type="button"
                      onClick={handleToggleShuffle}
                      aria-label={isShuffle ? 'Shuffle on' : 'Shuffle off'}
                      aria-pressed={isShuffle}
                      className={`p-2.5 rounded-xl transition-all ${isShuffle ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-white/40 hover:text-white hover:bg-white/4'}`}
                    >
                      <Shuffle className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={!hasMultipleTracks}
                      aria-label="Previous track"
                      className="p-2.5 text-white/80 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                    >
                      <SkipBack className="h-6 w-6 fill-current" />
                    </button>

                    <button
                      type="button"
                      onClick={handleTogglePlay}
                      aria-label={isEffectivelyPlaying ? 'Pause' : 'Play'}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-tr from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] active:scale-95"
                    >
                      {isEffectivelyPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current ml-1" />}
                    </button>

                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!hasMultipleTracks}
                      aria-label="Next track"
                      className="p-2.5 text-white/80 hover:text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:scale-110 active:scale-95"
                    >
                      <SkipForward className="h-6 w-6 fill-current" />
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleRepeat}
                      aria-label={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
                      className={`p-2.5 rounded-xl transition-all ${repeatMode !== 'off' ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20' : 'text-white/40 hover:text-white hover:bg-white/4'}`}
                    >
                      {repeatMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
                    </button>
                  </div>

                </div>
              </div>
            ) : null}
          </>
        );
}
