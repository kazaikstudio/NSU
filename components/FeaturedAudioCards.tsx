'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Heart,
  Download,
  Play,
  Pause,
} from 'lucide-react';

export interface FeaturedAudioTrack {
  id: string;
  title: string;
  artist?: string;
  fileUrl: string;
  coverUrl?: string;
  driveFileId?: string;
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
  if (track.coverUrl) return track.coverUrl;

  if (track.driveFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(track.driveFileId)}&sz=w400`;
  }

  const fileId = track.fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
  return fileId
    ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId[1] || fileId[2])}&sz=w400`
    : '/noll.jpg';
}

// Waveform bar height matrix
const WAVEFORM_HEIGHTS = [
  40, 60, 80, 50, 70, 95, 55, 40, 75, 90, 100, 50, 80, 60,
  90, 70, 40, 55, 90, 100, 75, 50, 85, 95, 60, 45, 70, 85,
  55, 75, 95, 40, 60, 80, 50
];

export default function FeaturedAudioCards() {
  const [tracks, setTracks] = useState<FeaturedAudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Like management states
  const [likedTracks, setLikedTracks] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

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
    }
  ];

  useEffect(() => {
    let cancelled = false;

    const loadFeaturedTracks = async () => {
      try {
        const response = await fetch('/api/audio');
        const data = await response.json();
        if (!cancelled) {
          const loadedTracks: FeaturedAudioTrack[] =
            data.tracks && data.tracks.length > 0
              ? (data.tracks || []).slice(0, 5).map((track: FeaturedAudioTrack) => ({
                  ...track,
                  fileUrl: getPlayableAudioUrl(track.fileUrl),
                }))
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
    if (tracks.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      const container = sliderRef.current;
      if (!container) return;

      const nextIndex = (currentIndex + 1) % tracks.length;
      const cardWidth = container.firstElementChild?.clientWidth || container.clientWidth;

      container.scrollTo({
        left: nextIndex * cardWidth,
        behavior: 'smooth',
      });

      setCurrentIndex(nextIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, tracks.length, isHovered]);

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
        onScroll={(event) => {
          const cardWidth =
            event.currentTarget.firstElementChild?.clientWidth ||
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
                onClick={() => handleTogglePlay(track)}
                className={`w-full shrink-0 snap-center sm:w-87.5 border rounded-3xl p-6 shadow-xl flex flex-col gap-5 cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? 'bg-Audicard border-amber-400/50 shadow-amber-500/10'
                    : 'bg-Audicard1 border-white/10 hover:border-white/20'
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
                    className="relative group/btn w-16 h-16 rounded-full bg-zinc-800 overflow-hidden shrink-0 border-2 border-white/20 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <img
                      src={normalizeImageUrl(getTrackThumbnailUrl(track))}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover/btn:scale-110"
                    />

                    <div
                      className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                        isCurrentlyPlaying
                          ? 'bg-black/50 opacity-100'
                          : 'bg-black/40 opacity-0 group-hover/btn:opacity-100'
                      }`}
                    >
                      <div className="p-2 rounded-full bg-amber-400 text-slate-950 shadow-md">
                        {isCurrentlyPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold text-lg truncate w-full">
                      {track.title || 'Untitled Track'}
                    </h3>
                    <p className="text-zinc-300 text-sm truncate w-full">
                      {track.artist || 'Unknown Artist'}
                    </p>
                  </div>
                </div>

                {/* Waveform Visualizer */}
                <div className="py-1">
                  <div
                    onClick={handleSeek}
                    className="flex items-center justify-between gap-1 h-8 px-1 cursor-pointer group"
                    title="Click to seek position"
                  >
                    {WAVEFORM_HEIGHTS.map((height, i) => {
                      const barRatio = i / WAVEFORM_HEIGHTS.length;
                      const isPlayedBar = isSelected && barRatio <= progressRatio;

                      return (
                        <span
                          key={i}
                          className={`w-1 rounded-full transition-colors duration-150 ${
                            isPlayedBar
                              ? 'bg-[#fdd835]'
                              : 'bg-white/40 group-hover:bg-white/60'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-zinc-300">
                  <button
                    type="button"
                    onClick={(e) => handleLikeToggle(e, track.id)}
                    className={`flex items-center gap-1.5 text-xs transition-colors ${
                      likedTracks[track.id]
                        ? 'text-red-500 hover:text-red-400'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform active:scale-125 ${
                        likedTracks[track.id] ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                    <span>
                      {likedTracks[track.id] ? 'Liked' : 'Like'}
                    </span>
                    <span className="ml-0.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                      {likeCounts[track.id] ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => void handleDownloadClick(e, track)}
                    className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
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
