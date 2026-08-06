"use client";

import React, { useRef, useState, useEffect, use } from "react";
import Link from "next/link";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, ArrowLeft } from "lucide-react";

type MediaItem = {
  id: string;
  title: string;
  fileUrl?: string;
  url?: string;
  thumbnail?: string;
};

export default function ComedyVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [videoSrc, setVideoSrc] = useState<string>("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4");
  const [videoTitle, setVideoTitle] = useState<string>("Comedy Video");
  const [loading, setLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    const fetchVideoDetails = async () => {
      try {
        setLoading(true);
        // 1. Check local storage or fetch from storage API to match talk-show uploads / short videos
        const storageResponse = await fetch('/api/dashboard/storage?source=talk-show');
        const storageData = await storageResponse.json().catch(() => ({ items: [] }));
        
        const foundUpload = (storageData.items || []).find((item: any) => String(item.id) === String(id));
        
        if (foundUpload) {
          const matchedUrl = foundUpload.file_url || foundUpload.url;
          if (matchedUrl) setVideoSrc(matchedUrl);
          if (foundUpload.title) setVideoTitle(foundUpload.title);
          return;
        }

        // 2. If not found in storage, check YouTube shorts list if stored or fetch from YouTube video details API endpoint
        const ytRes = await fetch(`/api/youtube/videos?channelId=UCDwZ_ENzU7LIDA5F8EYf1Jg`);
        const ytData = await ytRes.json().catch(() => ({}));
        
        const allShorts = ytData?.shorts || [];
        const foundShort = allShorts.find((s: any) => String(s.id) === String(id));

        if (foundShort) {
          if (foundShort.fileUrl || foundShort.url) {
            setVideoSrc(foundShort.fileUrl || foundShort.url);
          }
          if (foundShort.title) setVideoTitle(foundShort.title);
        }
      } catch (err) {
        console.error("Failed to load custom video source:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchVideoDetails();
  }, [id]);

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

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [videoSrc]);

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
    const videoContainer = videoRef.current?.parentElement;
    if (!videoContainer) return;

    if (!document.fullscreenElement) {
      videoContainer.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
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
    <main className="min-h-screen bg-backnav text-primary flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-300">
      <div className="w-full max-w-4xl space-y-4">
        
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-card1/15 bg-cardcl/60 px-4 py-2 text-xs font-semibold text-secondary backdrop-blur-md transition-all duration-200 hover:border-navlink/40 hover:bg-cardcl hover:text-navlink"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-medium text-xs bg-cardcl/80 border border-card1/15 px-3 py-1 rounded-full text-primary truncate max-w-[200px] sm:max-w-xs">
              {videoTitle}
            </span>
            <span className="font-mono text-xs bg-cardcl/80 border border-card1/15 px-2.5 py-1 rounded-full text-secondary hidden sm:inline-block">
              ID: {id}
            </span>
          </div>
        </div>

        {/* Video Player Container */}
        <div 
          className="relative w-full aspect-video bg-mrow rounded-3xl overflow-hidden shadow-2xl border border-card1/15 group backdrop-blur-xl"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
              Loading video player...
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-cover cursor-pointer"
              onClick={togglePlay}
              playsInline
              crossOrigin="anonymous"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}

          {/* Center Play Button Overlay on Pause */}
          {!isPlaying && !loading && (
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs cursor-pointer transition-opacity"
              onClick={togglePlay}
            >
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-navlink text-white flex items-center justify-center shadow-lg shadow-navlink/30 transition hover:scale-110 active:scale-95">
                <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-current translate-x-0.5" />
              </div>
            </div>
          )}

          {/* Custom Controls Bar */}
          <div 
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-2.5 transition-opacity duration-300 ${
              showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Scrubber / Progress Bar */}
            <div className="relative flex items-center w-full group/slider">
              <input
                type="range"
                min="0"
                max="100"
                value={progress || 0}
                onChange={handleProgressChange}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-navlink hover:h-2 transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-white text-xs sm:text-sm">
              {/* Left Controls (Play, Volume, Time) */}
              <div className="flex items-center gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-1 hover:text-navlink transition-colors"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
                </button>

                <div className="flex items-center gap-2 group/vol">
                  <button 
                    type="button"
                    onClick={toggleMute}
                    className="p-1 hover:text-navlink transition-colors"
                    aria-label="Toggle Mute"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-14 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-navlink"
                  />
                </div>

                <div className="text-slate-300 font-mono text-xs">
                  <span>{formatTime(currentTime)}</span>
                  <span className="mx-1 opacity-60">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls (Restart, Fullscreen) */}
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
                  className="p-1 hover:text-navlink transition-colors"
                  title="Restart"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-1 hover:text-navlink transition-colors"
                  aria-label="Toggle Fullscreen"
                >
                  <Maximize className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}