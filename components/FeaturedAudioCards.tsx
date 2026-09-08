'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Download,
  Play,
  Pause,
} from 'lucide-react';
import { getClientCachedData, hasClientCachedData } from '@/lib/client-cache';
import { registerClientDownload } from '@/lib/download-controls';

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

  // Sync the audio element's playback state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
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

  return (
    <div className="w-full max-w-9xl mx-auto">
      <audio ref={audioRef} />

      <div className="flex items-center gap-3 mb-2">
        <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
        <span className="text-sm sm:text-lg md:text-xl font-bold uppercase font-mono text-zinc-400">
          Latest Uploaded Tracks
        </span>
      </div>

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

            return (
              <div
                key={track.id}
                data-track-id={track.id}
                onClick={() => handleTogglePlay(track)}
                className={`w-full shrink-0 snap-center sm:w-87.5 rounded-3xl p-6 backdrop-blur-2xl border flex flex-col gap-5 cursor-pointer transition-all duration-500 shadow-2xl relative overflow-hidden group ${
                  isSelected
                    ? 'bg-linear-to-br from-Audicard/90 via-Audicard/50 to-amber-500/10 border-amber-400/50 shadow-amber-500/20 ring-1 ring-amber-400/40'
                    : 'bg-linear-to-br from-Audicard1/90 via-Audicard1/60 to-zinc-900/40 border-white/8 hover:border-white/20 hover:shadow-cyan-500/5'
                }`}
                >
                {/* Background Ambient Glow Accent */}
                <div className="absolute -right-12 -top-12 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-400/20 transition-all duration-700" />

                {/* Header Section: Compact & Immersive Player Layout */}
                <div className="flex items-center gap-4 relative z-10">
                  <div className="relative group/btn w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-white/15 shadow-xl bg-zinc-900">
                    <img
                      src={normalizeImageUrl(getTrackThumbnailUrl(track))}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/btn:scale-110"
                    />

                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-300 backdrop-blur-xs ${
                        isCurrentlyPlaying
                          ? 'bg-black/60 opacity-100'
                          : 'bg-black/40 opacity-0 group-hover/btn:opacity-100'
                      }`}
                    >
                      <div className="p-3 rounded-full bg-amber-400 text-slate-950 shadow-lg transform transition-transform duration-300 group-hover/btn:scale-110">
                        {isCurrentlyPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase bg-white/10 text-amber-300 border border-white/5">
                        Track
                      </span>
                      {isCurrentlyPlaying && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold text-base tracking-tight truncate w-full group-hover:text-amber-200 transition-colors">
                      {track.title || 'Untitled Track'}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium truncate">
                      {track.artist || 'Audio Track'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-white/8 relative z-10">
                  <button
                    type="button"
                    onClick={(e) => void handleDownloadClick(e, track)}
                    className="flex w-full items-center justify-center gap-2 text-xs font-medium text-zinc-400 bg-white/2 border border-white/5 hover:text-white hover:bg-white/6 hover:border-white/10 transition-all py-2 px-3 rounded-xl shadow-sm"
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
