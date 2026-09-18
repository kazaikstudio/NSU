'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import {
  Download,
  Play,
  Pause,
} from 'lucide-react';
import Pined from './Pined';
import { usePinnedTrackFileUrls } from '@/lib/pinned-tracks';
import { readCachedData, writeCachedData } from '@/lib/client-cache';
import { fetchAudioData, type AudioPageResponse } from '@/lib/audio-data';
import { primeAudioStart } from '@/lib/audio-preload';
import { openAudioPlayer } from '@/lib/audio-player';
import { subscribeTrackCounts, type TrackCountsSnapshot } from '@/lib/audio-counts';
import { extractStoredFileId, getStoredThumbnailUrl, recordTrackPlay } from '@/lib/media-url';
import { downloadTrackFile } from '@/lib/download-track';
import { buildArtistCredit, buildAudioDownloadName } from '@/lib/download';

export interface FeaturedAudioTrack {
  id: string;
  title: string;
  artist?: string;
  artistName?: string;
  featuredArtistName?: string | null;
  fileUrl: string;
  coverUrl?: string;
  driveFileId?: string | null;
  thumbnailUrl?: string | null;
  thumbnailDriveFileId?: string | null;
  duration?: string;
  playCount?: number;
  downloadCount?: number;
  pinned?: boolean;
}

const FEATURED_TRACKS_CACHE = 'audio-page:featured-tracks';

let featuredCache: FeaturedAudioTrack[] | null = null;

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

function normalizeImageUrl(url?: string) {
  if (!url) return undefined;
  try {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
    const fid = m ? (m[1] || m[2]) : null;
    return fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w400` : url;
  } catch {
    return url;
  }
}

function getTrackThumbnailUrl(track: FeaturedAudioTrack) {
  if (track.thumbnailUrl) return track.thumbnailUrl;
  if (track.coverUrl) return track.coverUrl;

  if (track.thumbnailDriveFileId) {
    return getStoredThumbnailUrl(`/api/dashboard/media/${track.thumbnailDriveFileId}`, null, 400) ?? '/noll.jpg';
  }

  return '/noll.jpg';
}

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function getCardMetrics(container: HTMLElement) {
  const row = container.firstElementChild as HTMLElement | null;
  const card = row?.firstElementChild as HTMLElement | null;
  const cardWidth = card?.clientWidth || container.clientWidth;
  const gap = row ? parseFloat(getComputedStyle(row).columnGap) || 0 : 0;
  const cardStyle = card ? getComputedStyle(card) : null;
  const margin = cardStyle
    ? (parseFloat(cardStyle.marginLeft) || 0) + (parseFloat(cardStyle.marginRight) || 0)
    : 0;
  const paddingLeft = parseFloat(getComputedStyle(container).paddingLeft) || 0;
  return { cardWidth, gap, margin, paddingLeft, step: cardWidth + gap + margin };
}

function getCenteredScrollLeft(container: HTMLElement, index: number) {
  const row = container.firstElementChild as HTMLElement | null;
  const card = row?.children[index] as HTMLElement | null;
  if (!card) return container.scrollLeft;

  const containerRect = container.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const delta =
    containerRect.left + containerRect.width / 2 - (cardRect.left + cardRect.width / 2);

  return Math.max(
    0,
    Math.min(container.scrollLeft + delta, container.scrollWidth - container.clientWidth)
  );
}

function isMobileView() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

interface FeaturedAudioStorageItem {
  title?: string;
  fileUrl?: string;
  thumbnailUrl?: string;
}

const MAX_FEATURED_TRACKS = 5;

function normalizeFeaturedTracks(data: {
  tracks?: FeaturedAudioTrack[];
  storageItems?: FeaturedAudioStorageItem[];
}, pinnedFileUrls: string[] = []): FeaturedAudioTrack[] {
  const storageItems = Array.isArray(data.storageItems) ? data.storageItems : [];
  const sourceTracks = Array.isArray(data.tracks) && data.tracks.length > 0 ? data.tracks : [];

  if (sourceTracks.length === 0) return exampleTracks;

  const pinnedSet = new Set(pinnedFileUrls);
  const normalized = sourceTracks.map((track) => {
    const dashboardItem = storageItems.find(
      (item) =>
        item.fileUrl === track.fileUrl ||
        item.title?.trim().toLowerCase() === track.title?.trim().toLowerCase(),
    );

    const rawFileUrl = track.fileUrl;
    const rawMatchId = rawFileUrl.match(/[?&]id=([^&]+)/)?.[1] ?? null;
    const isPinned = rawMatchId
      ? Array.from(pinnedSet).some((pinned) => pinned === rawFileUrl || pinned === rawMatchId || pinned.includes(rawMatchId))
      : pinnedSet.has(rawFileUrl);

    return {
      ...track,
      artist: buildArtistCredit(track.artistName || track.artist, track.featuredArtistName),
      fileUrl: getPlayableAudioUrl(track.fileUrl),
      thumbnailUrl: dashboardItem?.thumbnailUrl || track.thumbnailUrl,
      pinned: isPinned,
    };
  });

  // Keep pinned tracks at the front so new uploads never push them off the
  // carousel. Remaining slots are filled with the latest unpinned tracks.
  const pinnedTracks = normalized.filter((track) => track.pinned);
  const otherTracks = normalized.filter((track) => !track.pinned);
  const fillCount = Math.max(0, MAX_FEATURED_TRACKS - pinnedTracks.length);

  return [...pinnedTracks, ...otherTracks.slice(0, fillCount)];
}

const CARD_COLORS = ['#8B5CF6', '#3B82F6', '#06B6D4', '#EC4899', '#F59E0B'];

const exampleTracks: FeaturedAudioTrack[] = [
  {
    id: '1',
    title: 'Echoes of Midnight',
    artist: 'Michael John, 1978 Mvc studio',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Sample Track Two',
    artist: 'Unknown Artist',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop',
  },
];

export default function AudioCardsLatest() {
  const [tracks, setTracks] = useState<FeaturedAudioTrack[]>([]);
  const pinnedFileUrls = usePinnedTrackFileUrls();
  const [liveCounts, setLiveCounts] = useState<Record<string, TrackCountsSnapshot>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);
  const tracksRef = useRef<FeaturedAudioTrack[]>(tracks);
  const preloadedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
  }, [activeTrackId]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  // Mirror live play/download counts from the shared registry so the cards stay
  // in sync with every other surface when playback or a download happens.
  useEffect(() => {
    let active = true;
    const unsubscribers = tracks.map((track) =>
      subscribeTrackCounts(track.fileUrl, (snapshot) => {
        if (!active) return;
        setLiveCounts((prev) => ({ ...prev, [track.id]: snapshot }));
      }),
    );

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [tracks]);

  // Pause this carousel when another audio element starts playing.
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const audio = audioRef.current;
      if (audio && e.target !== audio) {
        audio.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('play', handleGlobalPlay, true);
    return () => window.removeEventListener('play', handleGlobalPlay, true);
  }, []);

  // When playback is paused on a selected track, flip the card back after 5 seconds.
  useEffect(() => {
    if (activeTrackId === null || isPlaying) return;

    const timer = setTimeout(() => {
      setActiveTrackId(null);
      setCurrentTime(0);
      setDuration(0);
    }, 5000);

    return () => clearTimeout(timer);
  }, [activeTrackId, isPlaying]);

  const scrollTrackIntoView = (trackId: string) => {
    if (!window.matchMedia('(max-width: 639px)').matches) return;

    requestAnimationFrame(() => {
      const container = sliderRef.current;
      if (!container) return;
      const trackCard = container.querySelector<HTMLElement>(
        `[data-track-id="${CSS.escape(trackId)}"]`
      );
      if (!trackCard) return;
      const row = container.firstElementChild as HTMLElement | null;
      const index = Array.from(row?.children || []).indexOf(trackCard);
      if (index === -1) {
        trackCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        return;
      }
      const target = getCenteredScrollLeft(container, index);
      if (Math.abs(target - container.scrollLeft) > 1) {
        container.scrollTo({ left: target, behavior: 'smooth' });
      }
    });
  };

  // Start buffering the very start of this track so clicking it plays quickly,
  // while never downloading more than the first moments.
  const primeTrack = (fileUrl: string) => {
    if (isPlaying) return;
    primeAudioStart(fileUrl, audioRef.current);
  };

  const toPlayerTrack = (track: FeaturedAudioTrack) => ({
    id: track.id,
    title: track.title || 'Untitled Track',
    artist: track.artist || track.artistName,
    src: track.fileUrl,
    thumbnailUrl: getTrackThumbnailUrl(track),
    fileUrl: track.fileUrl,
  });

  const openPlayer = (track: FeaturedAudioTrack, index: number) => {
    openAudioPlayer({
      track: toPlayerTrack(track),
      queue: tracksRef.current.map(toPlayerTrack),
      queueIndex: index,
    });
  };

  useEffect(() => {
    let cancelled = false;

    const syncTracks = async () => {
      try {
        const data = await fetchAudioData();
        if (cancelled) return;

        const sourceCount = Array.isArray(data.tracks) ? data.tracks.length : 0;
        const pinned = pinnedFileUrls;
        const nextTracks = normalizeFeaturedTracks(data as AudioPageResponse, pinned);
        if (nextTracks.length === 0) return;

        // A fallback/demo payload never replaces the saved good list. If the
        // cache has real tracks, keep showing them; only show placeholders when
        // there is nothing genuine saved.
        const isPlaceholder = data.fallback === true || sourceCount === 0;
        if (isPlaceholder) {
          const cached = featuredCache ?? readCachedData<FeaturedAudioTrack[]>(FEATURED_TRACKS_CACHE);
          if (cached && cached.length > 0) {
            setTracks((prev) =>
              prev.length === 0 || JSON.stringify(prev) !== JSON.stringify(cached) ? cached : prev
            );
            return;
          }
        }

        if (isPlaceholder) {
          setTracks((prev) => (prev.length > 0 ? prev : nextTracks));
          return;
        }

        featuredCache = nextTracks;
        writeCachedData(FEATURED_TRACKS_CACHE, nextTracks);
        setTracks((prev) => {
          const currentIds = new Set(prev.map((track) => track.id));
          const hasChanges =
            prev.length !== nextTracks.length ||
            nextTracks.some((track) => !currentIds.has(track.id)) ||
            nextTracks.some((track, i) => prev[i]?.id !== track.id) ||
            nextTracks.some((track, i) => prev[i]?.pinned !== track.pinned);
          return hasChanges ? nextTracks : prev;
        });

        const activeId = activeTrackIdRef.current;
        if (activeId !== null && !nextTracks.some((track) => track.id === activeId)) {
          audioRef.current?.pause();
          setIsPlaying(false);
          setCurrentTime(0);
          setActiveTrackId(null);
        }
      } catch (error) {
        console.error('Failed to sync featured audio from the database:', error);
        setTracks((prev) => (prev.length > 0 ? prev : exampleTracks));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Serve the cached list on first mount and when navigating back to this
    // page, so the network is only hit on a hard refresh or when the cache
    // has gone stale. Deferred by a microtask so no state is set synchronously
    // within the effect body.
    const loadInitial = async () => {
      await Promise.resolve();

      // Restore from disk so switching tabs or navigating away and back never
      // re-fetches the whole list — the network is only hit when the saved
      // cache is missing or has gone stale.
      const saved = readCachedData<FeaturedAudioTrack[]>(FEATURED_TRACKS_CACHE);
      if (saved && saved.length > 0) {
        featuredCache = saved;
      }

      const cached = featuredCache;
      const isHardRefresh =
        typeof performance.getEntriesByType === 'function' &&
        ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload');

      if (cached && cached.length > 0 && !isHardRefresh) {
        setTracks(cached);
        setLoading(false);
        return;
      }

      await syncTracks();
    };
    void loadInitial();

    const handleFocus = () => {
      if (!featuredCache && !readCachedData<FeaturedAudioTrack[]>(FEATURED_TRACKS_CACHE)) {
        void syncTracks();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, [pinnedFileUrls]);

  // Sync the audio element's playback state and time updates.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const list = tracksRef.current;
      if (list.length === 0) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      const currentIdx = list.findIndex((track) => track.id === activeTrackIdRef.current);
      const nextIndex = currentIdx === -1 ? 0 : (currentIdx + 1) % list.length;
      const nextTrack = list[nextIndex];

      if (!nextTrack) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }

      setIsPlaying(true);
      setCurrentIndex(nextIndex);
      setActiveTrackId(nextTrack.id);
      setCurrentTime(0);
      setDuration(0);
      scrollTrackIntoView(nextTrack.id);

      if (audioRef.current) {
        audioRef.current.src = nextTrack.fileUrl;
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [activeTrackId]);

  // Near the end of the current track, buffer the start of the next one so the
  // auto-advance starts immediately. Bounded so only the tail of the song is
  // pre-downloaded, keeping data usage low.
  useEffect(() => {
    if (!activeTrackId || preloadedForIdRef.current === activeTrackId) return;

    const audio = audioRef.current;
    if (!audio) return;

    const remaining = (duration > 0 ? duration : audio.duration) - currentTime;
    if (!Number.isFinite(remaining) || remaining < 0 || remaining > 20) return;

    const list = tracksRef.current;
    const currentIdx = list.findIndex((track) => track.id === activeTrackId);
    const next = currentIdx === -1 ? null : list[(currentIdx + 1) % list.length];
    if (next) primeAudioStart(next.fileUrl, preloadRef.current, { budgetMs: 20000 });

    preloadedForIdRef.current = activeTrackId;
  }, [activeTrackId, currentTime, duration]);

  // Auto-slide effect every 5 seconds
  useEffect(() => {
    if (tracks.length <= 1 || isHovered || (activeTrackId !== null && isPlaying)) return;

    const interval = setInterval(() => {
      const container = sliderRef.current;
      if (!container) return;

      const nextIndex = (currentIndex + 1) % tracks.length;
      const { cardWidth } = getCardMetrics(container);

      container.scrollTo({
        left: isMobileView() ? getCenteredScrollLeft(container, nextIndex) : nextIndex * cardWidth,
        behavior: 'smooth',
      });

      setCurrentIndex(nextIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTrackId, currentIndex, isPlaying, tracks.length, isHovered]);

  // On mobile, center the nearest card once a manual scroll settles. Native
  // scroll-snap snaps during the swipe; this is a safety net so the first and
  // last cards (which browsers sometimes fail to center) still land centered.
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    if (!isMobileView()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleScroll = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const { step, paddingLeft } = getCardMetrics(el);
        const index = Math.round((el.scrollLeft - paddingLeft) / step);
        const clamped = Math.max(0, Math.min(index, tracksRef.current.length - 1));
        const target = getCenteredScrollLeft(el, clamped);
        if (Math.abs(target - el.scrollLeft) > 1) {
          el.scrollTo({ left: target, behavior: 'smooth' });
        }
      }, 100);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleTogglePlay = (track: FeaturedAudioTrack) => {
    if (activeTrackId === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        void audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setActiveTrackId(track.id);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
      scrollTrackIntoView(track.id);

      const audio = audioRef.current;
      if (!audio) return;

      // If this file is already the element's loaded/loading source (hover
      // priming), don't reassign it — resetting src aborts the in-flight
      // fetch and forces a slow restart.
      if (audio.currentSrc && audio.currentSrc !== track.fileUrl) {
        audio.src = track.fileUrl;
      }

      recordTrackPlay(track.fileUrl);
      void audio.play().catch((err) => {
        // AbortError is expected when a still-buffering track is superseded
        // by another click or a preload — not a real playback failure.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error("Error playing audio:", err);
        setIsPlaying(false);
      });
    }
  };

  const getDownloadUrl = (track: FeaturedAudioTrack) => {
    const fileId = extractStoredFileId(track.fileUrl);
    if (!fileId) return track.fileUrl;

    const params = new URLSearchParams({ download: '1', filename: buildAudioDownloadName(track.title, track.artist || track.artistName), title: track.title });
    if (track.artist) params.set('artist', track.artist);
    return `/api/dashboard/media/${encodeURIComponent(fileId)}?${params.toString()}`;
  };

  const handleDownloadClick = async (event: React.MouseEvent<HTMLButtonElement>, track: FeaturedAudioTrack) => {
    event.preventDefault();
    event.stopPropagation();

    const downloadUrl = getDownloadUrl(track);
    if (!downloadUrl) return;

    await downloadTrackFile({
      url: downloadUrl,
      title: track.title,
      artist: track.artist || track.artistName,
      src: getPlayableAudioUrl(track.fileUrl),
    });
  };

  if (loading) {
    return (
      <div className="-mx-4 overflow-x-auto scrollbar-none pb-8 pt-3 sm:w-full sm:mx-0 sm:px-8 sm:pb-10 sm:pt-8">
        <div className="flex gap-4 sm:gap-5">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="w-[calc(100%-1rem)] mx-2 shrink-0 sm:w-96 sm:mx-0 rounded-3xl p-5 bg-Audicard/60 backdrop-blur-xl border border-white/10 flex flex-col justify-between gap-4 overflow-hidden relative animate-pulse"
            >
              <div className="absolute inset-0 bg-neutral-900/40" />
              <div className="relative flex justify-between items-center gap-4 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-3">
                  <div className="h-4 w-3/4 rounded-md bg-white/10" />
                  <div className="h-3 w-1/2 rounded-md bg-white/10" />
                  <div className="h-3 w-16 rounded-md bg-white/5" />
                </div>
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10" />
              </div>
              <div className="relative flex items-center justify-between">
                <div className="h-3 w-28 rounded-md bg-white/5" />
                <div className="h-3 w-14 rounded-md bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        No uploaded audio available yet.
      </p>
    );
  }

  const BAR_HEIGHTS = [35, 65, 45, 90, 70, 40, 80, 55, 30, 85, 60, 50, 75, 40, 95, 60, 45, 80, 70, 55, 85, 40, 65, 50, 90, 65, 40, 75];

  return (
  <div className="w-full max-w-9xl mx-auto">
    <audio
      ref={audioRef}
      preload="none"
      onPlay={() => {
        const currentTrack = tracks.find((track) => track.id === activeTrackId);
        if (currentTrack) recordTrackPlay(currentTrack.fileUrl);
      }}
    />
    <audio ref={preloadRef} preload="none" className="hidden" />

    <div
      ref={sliderRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(true)}
className="-mx-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-8 pt-3 sm:w-full sm:mx-0 sm:px-8 sm:pb-10 sm:pt-8"
      onWheel={(event) => {
        if (window.matchMedia('(min-width: 640px)').matches && event.deltaY !== 0) {
          event.preventDefault();
          event.currentTarget.scrollLeft += event.deltaY;
        }
      }}
      onScroll={(event) => {
        const { cardWidth, step, paddingLeft } = getCardMetrics(event.currentTarget);
        const raw = isMobileView()
          ? (event.currentTarget.scrollLeft - paddingLeft) / step
          : event.currentTarget.scrollLeft / cardWidth;
        setCurrentIndex(
          Math.max(0, Math.min(Math.round(raw), tracks.length - 1))
        );
      }}
      >
      <div className="flex gap-4 sm:gap-5">
        {tracks.map((track, index) => {
          const cardColor = CARD_COLORS[index % CARD_COLORS.length];
          const isSelected = activeTrackId === track.id;
          const isCurrentlyPlaying = isSelected && isPlaying;
          const trackCurrentTime = isSelected ? currentTime : 0;
          const trackDuration = isSelected ? duration : 0;
          const progressPercent = trackDuration > 0 ? (trackCurrentTime / trackDuration) * 100 : 0;
          const live = liveCounts[track.id];
          const plays = Number(live?.playCount != null ? live.playCount : (track.playCount || 0));
          const downloads = Number(live?.downloadCount != null ? live.downloadCount : (track.downloadCount || 0));

          return (
            <div
              key={track.id}
              data-track-id={track.id}
              onClick={() => handleTogglePlay(track)}
              onPointerEnter={() => primeTrack(track.fileUrl)}
              onFocus={() => primeTrack(track.fileUrl)}
              className={`w-[calc(100%-1rem)] mx-2 shrink-0 snap-center sm:w-96 sm:mx-0 rounded-3xl p-5 bg-Audicard/90 backdrop-blur-xl border flex flex-col justify-between cursor-pointer transition-all duration-500 relative overflow-hidden group ${
                isSelected ? '' : 'hover:bg-Audicard'
              }`}
              style={{
                borderColor: isSelected
                  ? 'transparent'
                  : track.pinned
                    ? 'rgba(255, 130, 0, 0.95)'
                    : 'rgba(255,255,255,0.10)',
                boxShadow: isSelected
                  ? `inset 0 0 0 2px ${cardColor}55, 0 0 30px ${cardColor}30, 0 8px 30px rgba(0,0,0,0.36)`
                  : track.pinned
                    ? '0 0 14px rgba(255,150,0,0.42), 0 0 36px rgba(255,80,0,0.22), 0 0 72px rgba(255,40,0,0.12), inset 0 0 14px rgba(255,110,0,0.2), 0 8px 30px rgba(0,0,0,0.36)'
                    : '0 8px 30px rgba(0,0,0,0.36)',
              }}
            >
              {/* Background Thumbnail Image with Modern Frosted Glass Glow & Fade */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <Image
                  fill
                  unoptimized
                  src={normalizeImageUrl(getTrackThumbnailUrl(track)) || '/noll.jpg'}
                  alt=""
                  sizes="384px"
                  className="object-cover opacity-20 blur-xl scale-125 transition-transform duration-700 group-hover:scale-150"
                />
                <div className="absolute inset-0 bg-linear-to-br from-Audicard/90 via-Audicard/70 to-Audicard/95 backdrop-blur-md" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cardColor}20 0%, transparent 65%)` }} />
              </div>

              {track.pinned && (
                <div className="pointer-events-none absolute inset-0 z-0">
                  <div
                    className="w-full h-full"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 50%, rgba(255,210,60,0.3) 0%, rgba(255,120,0,0.2) 38%, rgba(255,40,0,0.1) 62%, transparent 78%)',
                    }}
                  />
                </div>
              )}

              {/* Flip container — holds both card faces and animates between them */}
              <div className="relative z-10" style={{ perspective: '1200px' }}>
                <div
                  className="grid transition-transform duration-700 ease-in-out"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isSelected ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front face — first view (idle) */}
                  <div
                    className={`col-start-1 row-start-1 flex flex-col justify-between gap-2.5 sm:gap-4 w-full ${isSelected ? 'pointer-events-none' : ''}`}
                    style={{
                      WebkitBackfaceVisibility: 'hidden',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(0deg)',
                    }}
                  >
                    <div className="flex justify-between items-center gap-4 w-full">
                      {/* Left: Text & Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-base sm:text-lg tracking-tight truncate min-w-0 drop-shadow-sm">
                            {track.title || 'Untitled Track'}
                          </span>
                          {track.pinned && (
                            <Pined size="md" title="Pinned to the featured audio carousel" />
                          )}
                        </div>
                        <p className="text-xs text-white/60 truncate mt-0.5">
                          {track.artist || 'Audio Track'}
                        </p>
                        <div className="flex items-center gap-3 mt-2.5">
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            <Play size={10} className="fill-current text-navlink" />
                            {plays.toLocaleString()} plays
                            </span>
                          </div>
                      </div>

                      {/* Right: Modern Floating Thumbnail Image with Soft Glow */}
                      <div
                        className="relative group/btn w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 shadow-lg bg-neutral-900 border border-white/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPlayer(track, index);
                        }}
                        title="Open full screen player"
                      >
                        <Image
                          fill
                          unoptimized
                          src={normalizeImageUrl(getTrackThumbnailUrl(track)) || '/noll.jpg'}
                          alt={track.title}
                          sizes="(max-width: 640px) 80px, 96px"
                          className="object-cover transition-transform duration-700 group-hover/btn:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover/btn:bg-transparent transition-colors" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs text-white/50 group-hover:text-white/70 transition-colors">
                      <span className="italic font-light">Click me Listen .....</span>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium me-3">
                          <Download size={10} className="shrink-0" />
                          {downloads.toLocaleString()} <span className="sm:hidden">Dls</span><span className="hidden sm:inline">downloads</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Back face — selected (now playing) */}
                  <div
                    className={`col-start-1 row-start-1 flex flex-col justify-between gap-2.5 sm:gap-4 w-full ${isSelected ? '' : 'pointer-events-none'}`}
                    style={{
                      WebkitBackfaceVisibility: 'hidden',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                    >
                    <div className="flex flex-col justify-start w-full">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-md"
                          style={{ backgroundColor: `${cardColor}22`, color: cardColor, border: `1px solid ${cardColor}40` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: cardColor }} />
                          Now Playing
                        </span>
                        <span className="text-[11px] font-mono text-white/50 tracking-wider">
                          HD AUDIO
                        </span>
                      </div>

                      {/* Waveform using natural bar heights */}
                      <div className="flex items-end gap-[2.5px] h-8 px-0.5">
                        {BAR_HEIGHTS.map((h, i) => {
                          const barPositionPercent = (i / BAR_HEIGHTS.length) * 100;
                          const isPast = barPositionPercent <= progressPercent;
                          return (
                            <div
                              key={i}
                              className="flex-1 rounded-full transition-colors duration-200"
                              style={{
                                height: `${h}%`,
                                backgroundColor: isPast ? cardColor : 'rgba(255,255,255,0.18)',
                                boxShadow: isPast && isCurrentlyPlaying ? `0 0 6px ${cardColor}` : 'none',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full transition-all duration-300 animate-fadeIn">
                      <div className="flex items-center gap-3">
                        {/* Modern Circular Play/Pause Button with Glow */}
                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full text-white flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                          style={{ backgroundColor: cardColor, boxShadow: `0 4px 20px ${cardColor}55` }}
                        >
                          {isCurrentlyPlaying ? (
                            <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                          )}
                        </div>

                        {/* Modern Frosted Download Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadClick(e, track);
                          }}
                          className="inline-flex items-center justify-center text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all p-2 sm:py-2 sm:px-3.5 rounded-2xl border border-white/10 shadow-sm hover:border-white/20 active:scale-95"
                          title="Download"
                        >
                          <Download className="w-4 h-4 shrink-0 text-white/80" />
                          <span className="hidden sm:inline ml-2 text-xs font-medium tracking-wide">Download</span>
                        </button>
                      </div>

                      {/* Timer & Sleek Indicator */}
                      <div className="flex items-center gap-2 bg-black/20 px-2.5 py-1 sm:gap-2.5 sm:px-3 sm:py-1.5 rounded-xl border border-white/5 backdrop-blur-md">
                        <span className="text-xs font-mono font-medium tracking-wider text-white/80">
                          {formatTime(trackCurrentTime)} <span className="text-white/40">/</span> {formatTime(trackDuration)}
                        </span>

                        {isCurrentlyPlaying && (
                          <div className="flex items-end gap-0.5 h-3 pl-1 border-l border-white/10">
                            <span className="w-0.5 animate-pulse h-full rounded-full" style={{ backgroundColor: cardColor }} />
                            <span className="w-0.5 animate-bounce h-2 rounded-full" style={{ backgroundColor: cardColor }} />
                            <span className="w-0.5 animate-pulse h-2.5 rounded-full" style={{ backgroundColor: cardColor }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })}
        <div className="w-2 shrink-0 sm:hidden" aria-hidden />
      </div>
    </div>
  </div>
  );
}
