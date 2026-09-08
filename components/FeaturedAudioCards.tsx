'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Heart,
  Download,
  Play,
  Pause,
} from 'lucide-react';
import { getClientCachedData, hasClientCachedData } from '@/lib/client-cache';

export interface FeaturedAudioTrack {
  id: string;
  title: string;
  artist?: string;
  fileUrl: string;
  coverUrl?: string;
  driveFileId?: string;
  thumbnailUrl?: string;
  thumbnailDriveFileId?: string;
  duration?: string;
  likesCount?: number;
}

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
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(track.thumbnailDriveFileId)}&sz=w400`;
  }

  return '/noll.jpg';
}

// Waveform bar height matrix
const WAVEFORM_HEIGHTS = [
  40, 60, 80, 50, 70, 95, 55, 40, 75, 90, 100, 50, 80, 60,
  90, 70, 40, 55, 90, 100, 75, 50, 85, 95, 60, 45, 70, 85,
  55, 75, 95, 40, 60, 80, 50
];

const exampleTracks: FeaturedAudioTrack[] = [
  {
    id: '1',
    title: 'Echoes of Midnight',
    artist: 'Michael John, 1978 Mvc studio',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=300&auto=format&fit=crop',
    likesCount: 12,
  },
  {
    id: '2',
    title: 'Sample Track Two',
    artist: 'Unknown Artist',
    fileUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop',
    likesCount: 5,
  },
];

export default function FeaturedAudioCards() {
  const [tracks, setTracks] = useState<FeaturedAudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(() => !hasClientCachedData('featured-audio'));
  const [isHovered, setIsHovered] = useState(false);

  // Like management states
  const [likedTracks, setLikedTracks] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const scrollTrackIntoView = (trackId: string) => {
    if (!window.matchMedia('(max-width: 639px)').matches) return;

    requestAnimationFrame(() => {
      const trackCard = sliderRef.current?.querySelector<HTMLElement>(
        `[data-track-id="${CSS.escape(trackId)}"]`
      );
      trackCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadFeaturedTracks = async () => {
      try {
        const data = await getClientCachedData('featured-audio', async () => {
          const response = await fetch('/api/audio');
          return response.json();
        });
        if (!cancelled) {
          const storageItems = Array.isArray(data.storageItems) ? data.storageItems : [];
          const loadedTracks: FeaturedAudioTrack[] =
            data.tracks && data.tracks.length > 0
              ? (data.tracks || []).slice(0, 5).map((track: FeaturedAudioTrack) => {
                  const dashboardItem = storageItems.find((item: { title?: string; fileUrl?: string; thumbnailUrl?: string }) =>
                    item.fileUrl === track.fileUrl || item.title?.trim().toLowerCase() === track.title?.trim().toLowerCase()
                  );

                  return {
                    ...track,
                    fileUrl: getPlayableAudioUrl(track.fileUrl),
                    thumbnailUrl: dashboardItem?.thumbnailUrl || track.thumbnailUrl,
                  };
                })
              : exampleTracks;

          setTracks(loadedTracks);

          const initialCounts: Record<string, number> = {};
          loadedTracks.forEach((t) => {
            initialCounts[t.id] = t.likesCount || 0;
          });
          setLikeCounts(initialCounts);
        }
      } catch (error) {
        console.error("Failed to load tracks, using example data:", error);
        if (!cancelled) {
          setTracks(exampleTracks);
          const initialCounts: Record<string, number> = {};
          exampleTracks.forEach((t) => {
            initialCounts[t.id] = t.likesCount || 0;
          });
          setLikeCounts(initialCounts);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFeaturedTracks();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync Audio HTML Element Events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [activeTrackId]);

  // Auto-slide effect every 5 seconds
  useEffect(() => {
    if (tracks.length <= 1 || isHovered || (activeTrackId !== null && isPlaying)) return;

    const interval = setInterval(() => {
      const container = sliderRef.current;
      if (!container) return;

      const nextIndex = (currentIndex + 1) % tracks.length;
      const cardWidth = container.firstElementChild?.firstElementChild?.clientWidth || container.clientWidth;

      container.scrollTo({
        left: nextIndex * cardWidth,
        behavior: 'smooth',
      });

      setCurrentIndex(nextIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTrackId, currentIndex, isPlaying, tracks.length, isHovered]);

  // Play / Pause Toggle Trigger
  const handleTogglePlay = (track: FeaturedAudioTrack) => {
    if (activeTrackId === track.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setActiveTrackId(track.id);
      setIsPlaying(true);
      setCurrentTime(0);
      scrollTrackIntoView(track.id);

      if (audioRef.current) {
        audioRef.current.src = track.fileUrl;
        audioRef.current.play().catch((err) => {
          console.error("Error playing audio:", err);
          setIsPlaying(false);
        });
      }
    }
  };

  const getDownloadUrl = (track: FeaturedAudioTrack) => {
    const match = track.fileUrl.match(/[?&]id=([^&]+)/);
    if (!match?.[1]) return track.fileUrl;

    return `/api/dashboard/media/${match[1]}?download=1&filename=${encodeURIComponent(`${track.title}.mp3`)}`;
  };

  const handleDownloadClick = async (event: React.MouseEvent<HTMLButtonElement>, track: FeaturedAudioTrack) => {
    event.preventDefault();
    event.stopPropagation();

    const downloadUrl = getDownloadUrl(track);
    if (!downloadUrl) return;

    window.dispatchEvent(new CustomEvent('nsu-download-status', {
      detail: { status: 'downloading', title: track.title, progress: 0, downloadedBytes: 0 },
    }));

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Download body is unavailable.');
      }

      const chunks: Uint8Array[] = [];
      let loaded = 0;
      let lastProgress = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          const nextProgress = Math.min(100, Math.round((loaded / total) * 100));
          if (nextProgress !== lastProgress) {
            lastProgress = nextProgress;
            window.dispatchEvent(new CustomEvent('nsu-download-status', {
              detail: { status: 'downloading', title: track.title, progress: nextProgress, downloadedBytes: loaded, totalBytes: total },
            }));
          }
        }
      }

      const blob = new Blob(chunks.map((chunk) => {
        const array = new Uint8Array(chunk.length);
        array.set(chunk);
        return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
      }), { type: 'audio/mpeg' });

      const anchor = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      anchor.href = objectUrl;
      anchor.download = `${track.title}.mp3`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status: 'done', title: track.title, progress: 100, downloadedBytes: loaded, totalBytes: total || loaded },
      }));
    } catch (error) {
      console.error('Download failed:', error);
      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status: 'error', title: track.title, progress: 0 },
      }));
    }
  };

  // Seek audio position
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle Like Toggle
  const handleLikeToggle = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();

    setLikedTracks((prevLiked) => {
      const isCurrentlyLiked = !!prevLiked[trackId];

      setLikeCounts((prevCounts) => ({
        ...prevCounts,
        [trackId]: (prevCounts[trackId] || 0) + (isCurrentlyLiked ? -1 : 1),
      }));

      return {
        ...prevLiked,
        [trackId]: !isCurrentlyLiked,
      };
    });
  };

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        Loading featured audio...
      </p>
    );
  }

  if (tracks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        No uploaded audio available yet.
      </p>
    );
  }

  return (
    <div className="w-full max-w-9xl mx-auto">
      {/* Hidden Global Audio Element */}
      <audio ref={audioRef} />

      <div className="flex items-center gap-3 mb-2">
        <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
        <span className="text-sm sm:text-lg md:text-xl font-bold uppercase font-mono text-zinc-400">
          Latest Uploaded Tracks
        </span>
      </div>

      {/* Cards Slider Container */}
      <div
        ref={sliderRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
        className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1"
        onWheel={(event) => {
          if (window.matchMedia('(min-width: 640px)').matches && event.deltaY !== 0) {
            event.preventDefault();
            event.currentTarget.scrollLeft += event.deltaY;
          }
        }}
        onScroll={(event) => {
          const cardWidth =
            event.currentTarget.firstElementChild?.firstElementChild?.clientWidth ||
            event.currentTarget.clientWidth;
          setCurrentIndex(
            Math.round(event.currentTarget.scrollLeft / cardWidth)
          );
        }}
      >
        <div className="flex gap-6">
          {tracks.map((track) => {
            const isSelected = activeTrackId === track.id;
            const isCurrentlyPlaying = isSelected && isPlaying;
            const progressRatio = isSelected && duration > 0 ? currentTime / duration : 0;

            return (
              <div
                key={track.id}
                data-track-id={track.id}
                onClick={() => handleTogglePlay(track)}
                className={`w-full shrink-0 snap-center sm:w-87.5 rounded-3xl p-6 backdrop-blur-xl border flex flex-col gap-5 cursor-pointer transition-all duration-500 shadow-2xl ${
                  isSelected
                    ? 'bg-gradient-to-b from-Audicard/90 to-Audicard/40 border-amber-400/40 shadow-amber-500/10 ring-1 ring-amber-400/30'
                    : 'bg-gradient-to-b from-Audicard1/80 to-Audicard1/40 border-white/[0.08] hover:border-white/[0.16] hover:bg-Audicard1/90'
                }`}
              >
                {/* Header Section */}
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label={isCurrentlyPlaying ? "Pause track" : "Play track"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePlay(track);
                    }}
                    className="relative group/btn w-16 h-16 rounded-2xl bg-zinc-900/80 overflow-hidden shrink-0 border border-white/10 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  >
                    <img
                      src={normalizeImageUrl(getTrackThumbnailUrl(track))}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/btn:scale-110"
                    />

                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-300 backdrop-blur-[2px] ${
                        isCurrentlyPlaying
                          ? 'bg-black/60 opacity-100'
                          : 'bg-black/40 opacity-0 group-hover/btn:opacity-100'
                      }`}
                    >
                      <div className="p-2.5 rounded-full bg-amber-400 text-slate-950 shadow-lg transform transition-transform duration-300 group-hover/btn:scale-105">
                        {isCurrentlyPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-base tracking-tight truncate w-full group-hover:text-amber-200/90 transition-colors">
                      {track.title || 'Untitled Track'}
                    </h3>
                    <p className="text-xs text-zinc-400/80 font-normal mt-0.5">
                      {track.artist || 'Audio Track'}
                    </p>
                  </div>
                </div>

                {/* Waveform Visualizer */}
                <div className="py-1">
                  <div
                    onClick={handleSeek}
                    className="flex items-center justify-between gap-1 h-9 px-1.5 cursor-pointer group bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-white/[0.04] transition-colors"
                    title="Click to seek position"
                  >
                    {WAVEFORM_HEIGHTS.map((height, i) => {
                      const barRatio = i / WAVEFORM_HEIGHTS.length;
                      const isPlayedBar = isSelected && barRatio <= progressRatio;

                      return (
                        <span
                          key={i}
                          className={`w-1 rounded-full transition-all duration-200 ${
                            isPlayedBar
                              ? 'bg-gradient-to-t from-amber-500 to-[#fdd835] shadow-[0_0_8px_rgba(253,216,53,0.4)]'
                              : 'bg-white/20 group-hover:bg-white/40'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-zinc-400">
                  <button
                    type="button"
                    onClick={(e) => handleLikeToggle(e, track.id)}
                    className={`flex items-center gap-2 text-xs font-medium transition-all py-1 px-2.5 rounded-full ${
                      likedTracks[track.id]
                        ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                        likedTracks[track.id] ? 'fill-red-400 text-red-400' : ''
                      }`}
                    />
                    <span>{likedTracks[track.id] ? 'Liked' : 'Like'}</span>
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      likedTracks[track.id] ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-zinc-300'
                    }`}>
                      {likeCounts[track.id] ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => void handleDownloadClick(e, track)}
                    className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-all py-1 px-2.5 rounded-full hover:bg-white/[0.06]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
