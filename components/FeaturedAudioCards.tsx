'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import {
  Download,
  Play,
  Pause,
} from 'lucide-react';
import { getClientCachedData, hasClientCachedData } from '@/lib/client-cache';
import { registerClientDownload } from '@/lib/download-controls';
import { getDownloadPath } from '@/lib/download';

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

function formatTime(seconds: number) {
  if (isNaN(seconds) || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

export default function FeaturedAudioCards() {
  const [tracks, setTracks] = useState<FeaturedAudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(() => !hasClientCachedData('featured-audio'));
  const [isHovered, setIsHovered] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
        }
      } catch (error) {
        console.error("Failed to load tracks, using example data:", error);
        if (!cancelled) {
          setTracks(exampleTracks);
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

  // Sync the audio element's playback state and time updates.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
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

    const params = new URLSearchParams({ download: '1', filename: `${track.title}.mp3`, title: track.title });
    if (track.artist) params.set('artist', track.artist);
    return `/api/dashboard/media/${match[1]}?${params.toString()}`;
  };

  const handleDownloadClick = async (event: React.MouseEvent<HTMLButtonElement>, track: FeaturedAudioTrack) => {
    event.preventDefault();
    event.stopPropagation();

    const downloadUrl = getDownloadUrl(track);
    if (!downloadUrl) return;

    window.dispatchEvent(new CustomEvent('nsu-download-status', {
      detail: { status: 'downloading', title: track.title, progress: 0, downloadedBytes: 0 },
    }));

    const controller = new AbortController();
    const downloadControl = registerClientDownload(track.title, () => controller.abort());

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store', signal: controller.signal });
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
        await downloadControl.waitUntilResumed();
        if (downloadControl.isCancelled()) return;

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
      anchor.download = getDownloadPath(`${track.title}.mp3`, 'audio', track.artist);
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status: 'done', title: track.title, progress: 100, downloadedBytes: loaded, totalBytes: total || loaded },
      }));
    } catch (error) {
      if (downloadControl.isCancelled() || (error instanceof Error && error.name === 'AbortError')) return;
      console.error('Download failed:', error);
      window.dispatchEvent(new CustomEvent('nsu-download-status', {
        detail: { status: 'error', title: track.title, progress: 0 },
      }));
    } finally {
      downloadControl.unregister();
    }
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

  const BAR_HEIGHTS = [35, 65, 45, 90, 70, 40, 80, 55, 30, 85, 60, 50, 75, 40, 95, 60, 45, 80, 70, 55, 85, 40, 65, 50, 90, 65, 40, 75];

  return (
  <div className="w-full max-w-9xl mx-auto">
    <audio ref={audioRef} />

    <div
      ref={sliderRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(true)}
      className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-none pb-8 pt-3 sm:pb-10 sm:pt-8 sm:px-8"
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
      <div className="flex gap-4 sm:gap-5">
        {tracks.map((track, index) => {
          const cardColor = CARD_COLORS[index % CARD_COLORS.length];
          const isSelected = activeTrackId === track.id;
          const isCurrentlyPlaying = isSelected && isPlaying;
          const trackCurrentTime = isSelected ? currentTime : 0;
          const trackDuration = isSelected ? duration : 0;
          const progressPercent = trackDuration > 0 ? (trackCurrentTime / trackDuration) * 100 : 0;

          return (
            <div
              key={track.id}
              data-track-id={track.id}
              onClick={() => handleTogglePlay(track)}
              className={`w-full shrink-0 snap-center sm:w-96 rounded-3xl p-5 bg-Audicard/90 backdrop-blur-xl border flex flex-col justify-between cursor-pointer transition-all duration-500 relative overflow-hidden group ${
                isSelected ? '' : 'hover:bg-Audicard'
              }`}
              style={{
                borderColor: isSelected ? `${cardColor}70` : 'rgba(255,255,255,0.10)',
                boxShadow: isSelected
                  ? `0 0 0 2px ${cardColor}50, 0 0 30px ${cardColor}30, 0 8px 30px rgba(0,0,0,0.36)`
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

              {/* Card 1 or Card 2 Upper Content based on selection visibility */}
              {!isSelected ? (
                <div className="flex justify-between items-center gap-4 relative z-10 w-full">
                  {/* Left: Text & Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/80 backdrop-blur-md">
                        Track
                      </span>
                    </div>
                    <span className="text-white font-semibold text-base sm:text-lg tracking-tight truncate w-full drop-shadow-sm">
                      {track.title || 'Untitled Track'}
                    </span>
                    <p className="text-xs text-white/60 truncate mt-0.5">
                      {track.artist || 'Audio Track'}
                    </p>
                  </div>

                  {/* Right: Modern Floating Thumbnail Image with Soft Glow */}
                  <div className="relative group/btn w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 shadow-lg bg-neutral-900 border border-white/10">
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
              ) : (
                <div className="flex flex-col justify-start relative z-10 w-full">
                  <div className="flex items-center justify-between mb-3">
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
              )}

              {/* Bottom Content Area: Contextually assigned to Card 1 or Card 2 */}
              {!isSelected ? (
                <div className="flex items-center gap-20 text-xs text-white/50 relative z-10 group-hover:text-white/70 transition-colors">
                  <span className="italic font-light">Click me Listen .....</span>
                  <svg className="w-3.5 h-3.5 transform translate-x-0 group-hover:translate-x-1 transition-transform" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between relative z-10 transition-all duration-300 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    {/* Modern Circular Play/Pause Button with Glow */}
                    <div
                      className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                      style={{ backgroundColor: cardColor, boxShadow: `0 4px 20px ${cardColor}55` }}
                    >
                      {isCurrentlyPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </div>

                    {/* Modern Frosted Download Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDownloadClick(e, track);
                      }}
                      className="inline-flex items-center justify-center text-white/90 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all p-2.5 sm:py-2 sm:px-3.5 rounded-2xl border border-white/10 shadow-sm hover:border-white/20 active:scale-95"
                      title="Download"
                    >
                      <Download className="w-4 h-4 shrink-0 text-white/80" />
                      <span className="hidden sm:inline ml-2 text-xs font-medium tracking-wide">Download</span>
                    </button>
                  </div>

                  {/* Timer & Sleek Indicator */}
                  <div className="flex items-center gap-2.5 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5 backdrop-blur-md">
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
  );
}
