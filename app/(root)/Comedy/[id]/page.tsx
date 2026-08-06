"use client";

import React, { useRef, useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  ArrowLeft,
  Share2,
  Download,
  Flame,
  Info,
  Check,
  Music
} from "lucide-react";

type PlaylistItem = {
  id: string;
  title: string;
  comedian?: string;
  duration?: string;
  views?: string;
  thumbnail?: string;
  fileUrl: string;
};

export default function ComedyVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [activeItem, setActiveItem] = useState<PlaylistItem | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [videoTitle, setVideoTitle] = useState<string>("Loading...");
  const [loading, setLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchDirectoryFiles = async () => {
      try {
        setLoading(true);
        const storageResponse = await fetch("/api/dashboard/storage?source=talk-show");
        const storageData = await storageResponse.json().catch(() => ({ items: [] }));
        const allItems: any[] = storageData.items || [];

        let current = allItems.find((item) => String(item.id) === String(id));

        if (!current && allItems.length > 0) {
          current = allItems[0];
        }

        if (current) {
          const mainUrl = current.file_url || current.url || "";
          setVideoSrc(mainUrl);
          setVideoTitle(current.title || current.name || "Untitled Track");

          const basePath = mainUrl.substring(0, mainUrl.lastIndexOf("/") + 1);

          let pathFiles: PlaylistItem[] = allItems
            .filter((item) => {
              const itemUrl = item.file_url || item.url || "";
              return itemUrl.startsWith(basePath);
            })
            .map((item) => ({
              id: String(item.id),
              title: item.title || item.name || itemUrl.split("/").pop() || "Audio File",
              comedian: item.artist || item.comedian || "Media Track",
              duration: item.duration || "--:--",
              views: item.views || "Audio Stream",
              fileUrl: item.file_url || item.url,
              thumbnail: item.thumbnail
            }));

          const matchedActive = pathFiles.find((f) => f.id === String(id)) || pathFiles[0];

          setPlaylist(pathFiles);
          setActiveItem(matchedActive);
        }
      } catch (err) {
        console.error("Failed to retrieve directory files:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDirectoryFiles();
  }, [id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    video.load();
    if (isPlaying) {
      video.play().catch((err) => {
        console.warn("Autoplay blocked or interrupted:", err);
        setIsPlaying(false);
      });
    }
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [videoSrc]);

  const selectVideo = (item: PlaylistItem) => {
    if (item.fileUrl) {
      setActiveItem(item);
      setVideoSrc(item.fileUrl);
      setVideoTitle(item.title);
      setIsPlaying(true);
    }
  };

  const handleVideoEnded = () => {
    if (!activeItem || playlist.length === 0) return;
    const currentIndex = playlist.findIndex((item) => item.id === activeItem.id);
    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
      selectVideo(playlist[currentIndex + 1]);
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = newTime;
    setProgress(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error(`Error entering fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: videoTitle,
          url: window.location.href
        });
      } catch (err) {
        console.log("Share cancelled or failed", err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = videoSrc;
    link.download = `${videoTitle.replace(/\s+/g, "_")}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);
  };

  return (
    <main className="min-h-screen mt-1 bg-zinc-950 text-zinc-100 flex flex-col p-1 sm:p-6 font-sans">
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-2 flex-1 items-start">

      {/* Sticky Video Section on desktop screens only */}
      <section className="lg:col-span-3 flex flex-col gap-1.5 sticky top-16 sm:top-20 h-fit z-20 bg-zinc-950 pb-2">
          <div
            ref={playerContainerRef}
            className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl group"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
                Loading directory media...
              </div>
            ) : (
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-cover cursor-pointer"
                onClick={togglePlay}
                playsInline
                autoPlay={isPlaying}
                crossOrigin="anonymous"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleVideoEnded}
              />
            )}

            {!isPlaying && !loading && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs cursor-pointer transition-opacity"
                onClick={togglePlay}
              >
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-orange-500 text-black flex items-center justify-center shadow-lg shadow-orange-500/20 transition hover:scale-110 active:scale-95">
                  <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current translate-x-0.5" />
                </div>
              </div>
            )}

            <div
              className={`absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/50 to-transparent px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-2.5 transition-opacity duration-300 ${
                showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="relative flex items-center w-full">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress || 0}
                  onChange={handleProgressChange}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:h-2 transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-white text-xs sm:text-sm">
                <div className="flex items-center gap-3 sm:gap-4">
                  <button type="button" onClick={togglePlay} className="p-1 hover:text-orange-400 transition-colors">
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                  </button>

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={toggleMute} className="p-1 hover:text-orange-400 transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-14 sm:w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>

                  <div className="text-zinc-400 font-mono text-xs">
                    <span>{formatTime(currentTime)}</span>
                    <span className="mx-1 opacity-60">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        videoRef.current.play();
                        setIsPlaying(true);
                      }
                    }}
                    className="p-1 hover:text-orange-400 transition-colors"
                    title="Restart"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1 hover:text-orange-400 transition-colors"
                    title="Full Screen"
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section className="w-full max-w-79xl mx-auto flex items-center justify-between">
            <Link
              href="/"
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 sm:gap-3 rounded-2xl sm:rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-3 sm:px-10 sm:py-2.5 text-xs font-semibold text-zinc-300 backdrop-blur-md transition hover:bg-zinc-800 hover:text-white active:scale-95"
            >
              <ArrowLeft size={14} className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </section>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5
            backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <span className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2 truncate">
                <Info size={18} className="text-orange-400 shrink-0" />
                <span className="truncate">{videoTitle}</span>
              </span>
              <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed max-w-xl">
                Powered by <span className="text-orange-400 font-semibold">Noll Music Ug</span> — your home for premium local beats and high-energy shows.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl sm:rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition active:scale-95 border border-zinc-700/50"
              >
                {copied ? <Check size={14} className="text-orange-400" /> : <Share2 size={14} />}
                <span>{copied ? "Copied Link" : "Share"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-4 py-2.5 rounded-xl sm:rounded-2xl bg-orange-500 hover:bg-orange-400 text-xs font-semibold text-black transition active:scale-95 shadow-md shadow-orange-500/20"
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            </div>
          </div>
      </section>

      <aside className="lg:col-span-1 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-3 backdrop-blur-md flex flex-col gap-2 lg:sticky lg:top-16 lg:self-start lg:h-[calc(100vh-5rem)] overflow-hidden">
        {/* Header (Pinned) */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 text-zinc-200 font-semibold text-sm">
            <Flame size={18} className="text-orange-500 fill-orange-500" />
            <span>Directory Files</span>
          </div>
          <span className="text-[10px] font-mono bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
            {playlist.length} Files
          </span>
        </div>

        {/* Scrollable Row List */}
        <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto pr-1">
          {playlist.length === 0 && !loading ? (
            <div className="text-xs text-zinc-500 p-4 text-center">No other files found in this path.</div>
          ) : (
            playlist.map((item, index) => {
              const isCurrent = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => selectVideo(item)}
                  className={`group flex items-center gap-3 p-2.5 rounded-2xl text-left transition-all ${
                    isCurrent
                      ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                      : "bg-zinc-800/40 border border-transparent hover:bg-zinc-800/80 text-zinc-300"
                  }`}
                >
                  <div className="relative shrink-0 w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700/50">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        {isCurrent ? (
                          <Play size={14} className="fill-orange-400 text-orange-400" />
                        ) : (
                          <Music size={14} className="text-zinc-500 group-hover:text-zinc-300" />
                        )}
                        <span className="text-[9px] font-mono text-zinc-500 mt-0.5">#{index + 1}</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate group-hover:text-zinc-100">{item.title}</p>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">{item.comedian}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-1">
                      <span>{item.duration}</span>
                      <span>•</span>
                      <span className="text-zinc-400">{item.views}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      </div>
    </main>
  );
}
