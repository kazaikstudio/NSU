"use client";

import type { CSSProperties, ChangeEvent, MouseEvent, PointerEvent, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

type ModernVideoPlayerProps = {
  src: string;
  loading?: boolean;
  onEndedAction?: () => void;
};

function formatTime(timeInSeconds: number) {
  if (Number.isNaN(timeInSeconds)) return "00:00";
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export default function ModernVideoPlayer({ src, loading = false, onEndedAction }: ModernVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const isSeekingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    video.load();
    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (isSeekingRef.current) {
        return;
      }

      setCurrentTime(video.currentTime);
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
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
  }, [src]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const queueHideControls = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      if (isPlayingRef.current) {
        setShowControls(false);
      }
    }, 2200);
  };

  const revealControls = () => {
    setShowControls(true);
    if (isPlayingRef.current) {
      queueHideControls();
    }
  };

  const handleSurfaceTouch = () => {
    if (!isMobile) {
      revealControls();
      return;
    }

    if (showControls) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      setShowControls(false);
      return;
    }

    revealControls();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        queueHideControls();
      }).catch(() => {
        setIsPlaying(false);
      });
      return;
    }

    video.pause();
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    isSeekingRef.current = true;
    const nextProgress = Number.parseFloat(event.target.value);
    const nextTime = (nextProgress / 100) * (duration || 0);
    setProgress(nextProgress);
    setCurrentTime(nextTime);
    revealControls();
  };

  const commitSeek = (nextProgress: number) => {
    const video = videoRef.current;
    if (!video) return;

    const nextTime = (nextProgress / 100) * (duration || 0);
    video.currentTime = nextTime;
    setProgress(nextProgress);
    setCurrentTime(nextTime);
    isSeekingRef.current = false;
    revealControls();
  };

  const handleSeekMouseUp = (event: MouseEvent<HTMLInputElement>) => {
    commitSeek(Number.parseFloat(event.currentTarget.value));
  };

  const handleSeekPointerUp = (event: PointerEvent<HTMLInputElement>) => {
    commitSeek(Number.parseFloat(event.currentTarget.value));
  };

  const handleSeekTouchEnd = (event: TouchEvent<HTMLInputElement>) => {
    commitSeek(Number.parseFloat(event.currentTarget.value));
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const nextVolume = Number.parseFloat(event.target.value);
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    revealControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      const restoredVolume = volume > 0 ? volume : 0.5;
      video.muted = false;
      video.volume = restoredVolume;
      setVolume(restoredVolume);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }

    revealControls();
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.play().then(() => {
      setIsPlaying(true);
      queueHideControls();
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
    revealControls();
  };

  const playerStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    borderRadius: isMobile ? 22 : 28,
    background: "radial-gradient(circle at top, rgba(92, 100, 255, 0.24), transparent 42%), linear-gradient(180deg, #101322 0%, #06070d 100%)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.38)",
  };

  const videoStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    background: "#000",
  };

  const loadingStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.78)",
    fontSize: "0.95rem",
    letterSpacing: "0.03em",
    background: "linear-gradient(180deg, rgba(11, 13, 24, 0.9), rgba(4, 5, 10, 0.96))",
  };

  const overlayButtonStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, rgba(5, 8, 18, 0.18), rgba(5, 8, 18, 0.48))",
    backdropFilter: "blur(8px)",
    border: 0,
    padding: 0,
    cursor: "pointer",
  };

  const playBubbleStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: isMobile ? 62 : 76,
    height: isMobile ? 62 : 76,
    borderRadius: 999,
    color: "#0f1222",
    background: "linear-gradient(135deg, #fff1a6 0%, #ff9b71 48%, #8f7cff 100%)",
    boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
    transition: "transform 180ms ease",
  };

  const controlsStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: isMobile ? 10 : 12,
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? 8 : 10,
    background: "linear-gradient(180deg, rgba(5, 8, 18, 0) 0%, rgba(5, 8, 18, 0.82) 38%, rgba(5, 8, 18, 0.95) 100%)",
    transition: "opacity 220ms ease, transform 220ms ease",
    opacity: showControls ? 1 : 0,
    transform: showControls ? "translateY(0)" : "translateY(8px)",
    pointerEvents: showControls ? "auto" : "none",
  };

  const seekWrapStyle: CSSProperties = {
    padding: 0,
    border: 0,
    background: "transparent",
    backdropFilter: "none",
  };

  const seekTopStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: isMobile ? "flex-start" : "space-between",
    marginBottom: isMobile ? 4 : 8,
    fontSize: isMobile ? 9 : 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.62)",
  };

  const rangeShellStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
  };

  const rangeTrackStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: isMobile ? 6 : 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
  };

  const rangeFillStyle = (width: string, height?: number): CSSProperties => ({
    position: "absolute",
    left: 0,
    height: height ?? (isMobile ? 6 : 8),
    width,
    borderRadius: 999,
    background: "linear-gradient(90deg, #8f7cff 0%, #d96dff 50%, #ffb46c 100%)",
    boxShadow: "0 0 20px rgba(217, 109, 255, 0.45)",
  });

  const rangeStyle: CSSProperties = {
    position: "relative",
    zIndex: 1,
    width: "100%",
    margin: 0,
    appearance: "none",
    WebkitAppearance: "none",
    background: "transparent",
    cursor: "pointer",
    accentColor: "#d96dff",
    borderRadius: 999,
  };

  const panelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: isMobile ? 0 : 10,
    padding: isMobile ? "0 0 2px" : 12,
    borderRadius: isMobile ? 0 : 24,
    border: isMobile ? 0 : "1px solid rgba(255,255,255,0.1)",
    background: isMobile ? "transparent" : "rgba(9, 11, 21, 0.6)",
    backdropFilter: isMobile ? "none" : "blur(18px)",
    color: "#f5f7ff",
  };

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: isMobile ? 4 : 10,
  };

  const rowGroupStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: isMobile ? 4 : 8,
    width: "auto",
    minWidth: 0,
  };

  const pillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: isMobile ? 6 : 8,
    minHeight: isMobile ? 30 : 38,
    padding: isMobile ? "0 9px" : "0 12px",
    borderRadius: 999,
    border: isMobile ? 0 : "1px solid rgba(255,255,255,0.1)",
    background: isMobile ? "transparent" : "rgba(255,255,255,0.08)",
    width: isMobile ? "fit-content" : undefined,
    maxWidth: isMobile ? "100%" : undefined,
    flexShrink: 0,
  };

  const timeStyle: CSSProperties = {
    fontSize: isMobile ? 9 : 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.92)",
    paddingLeft: isMobile ? 2 : 0,
  };

  const timeMutedStyle: CSSProperties = {
    color: "rgba(255,255,255,0.46)",
  };

  const primaryButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: isMobile ? 34 : 42,
    height: isMobile ? 34 : 42,
    borderRadius: 999,
    color: "#0f1222",
    background: "linear-gradient(135deg, #fff1a6 0%, #ff9b71 48%, #8f7cff 100%)",
    boxShadow: "0 12px 26px rgba(0, 0, 0, 0.28)",
    border: 0,
    cursor: "pointer",
  };

  const iconButtonStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: isMobile ? 30 : 36,
    height: isMobile ? 30 : 36,
    borderRadius: 999,
    color: "rgba(255,255,255,0.82)",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.08)",
    cursor: "pointer",
    flexShrink: 0,
  };

  const volumeWrapStyle: CSSProperties = {
    ...pillStyle,
    flex: 1,
    minWidth: 0,
    width: isMobile ? "auto" : undefined,
    maxWidth: isMobile ? 124 : 180,
    justifyContent: "flex-start",
    paddingLeft: isMobile ? 5 : 8,
    paddingRight: isMobile ? 8 : 12,
  };

  const volumeRangeShellStyle: CSSProperties = {
    ...rangeShellStyle,
    flex: 1,
    marginLeft: 2,
  };

  return (
    <div
      ref={containerRef}
      style={playerStyle}
      onMouseMove={revealControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onTouchStart={handleSurfaceTouch}
    >
      <style>{`
        .modern-video-range {
          -webkit-appearance: none;
          appearance: none;
        }

        .modern-video-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          display: block;
          box-sizing: border-box;
          width: 16px;
          min-width: 16px;
          max-width: 16px;
          height: 16px;
          min-height: 16px;
          max-height: 16px;
          margin-top: -4px;
          border: none;
          outline: none;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
        }

        .modern-video-range::-moz-range-thumb {
          -webkit-appearance: none;
          appearance: none;
          display: block;
          box-sizing: border-box;
          width: 16px;
          height: 16px;
          border: none;
          outline: none;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
        }

        .modern-video-range::-webkit-slider-runnable-track {
          height: 8px;
          background: transparent;
          border-radius: 999px;
        }

        .modern-video-range::-moz-range-track {
          height: 8px;
          background: transparent;
          border: none;
          border-radius: 999px;
        }

        .modern-video-range::-moz-focus-outer {
          border: 0;
        }

        @media (max-width: 639px) {
          .modern-video-range::-webkit-slider-thumb {
            width: 14px;
            min-width: 14px;
            max-width: 14px;
            height: 14px;
            min-height: 14px;
            max-height: 14px;
            margin-top: -4px;
            border-radius: 50%;
          }

          .modern-video-range::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
          }

          .modern-video-range::-webkit-slider-runnable-track,
          .modern-video-range::-moz-range-track {
            height: 6px;
            border-radius: 999px;
          }
        }
      `}</style>
      {loading ? (
        <div style={loadingStyle}>Loading video...</div>
      ) : (
        <video
          ref={videoRef}
          src={src}
          style={videoStyle}
          playsInline
          crossOrigin="anonymous"
          onClick={togglePlay}
          onPlay={() => {
            setIsPlaying(true);
            queueHideControls();
          }}
          onPause={() => {
            setIsPlaying(false);
            setShowControls(true);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setShowControls(true);
            onEndedAction?.();
          }}
        />
      )}

      {!loading && !isPlaying ? (
        <button type="button" style={overlayButtonStyle} onClick={togglePlay} aria-label="Play video">
          <span style={playBubbleStyle}>
            <Play size={34} fill="currentColor" />
          </span>
        </button>
      ) : null}

      {!loading ? (
        <div style={controlsStyle}>
          <div style={seekWrapStyle}>
            <div style={seekTopStyle}>
              {isMobile ? (
                <div style={pillStyle}>
                  <span style={timeStyle}>{formatTime(currentTime)}</span>
                  <span style={timeMutedStyle}>/</span>
                  <span style={timeMutedStyle}>{formatTime(duration)}</span>
                </div>
              ) : (
                <>
                  <span>Playing Now</span>
                  <span>{Math.round(progress)}%</span>
                </>
              )}
            </div>
            <div style={rangeShellStyle}>
              <div style={rangeFillStyle(`${progress}%`)} />
              <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
                onMouseUp={handleSeekMouseUp}
                onTouchEnd={handleSeekTouchEnd}
                onPointerUp={handleSeekPointerUp}
                style={rangeStyle}
                className="modern-video-range"
                aria-label="Seek video"
              />
            </div>
          </div>

          <div style={panelStyle}>
            <div style={rowStyle}>
              <div style={rowGroupStyle}>
                <button type="button" onClick={togglePlay} style={primaryButtonStyle} aria-label={isPlaying ? "Pause" : "Play"}>
                  {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                </button>

                {!isMobile ? (
                  <div style={pillStyle}>
                    <span style={timeStyle}>{formatTime(currentTime)}</span>
                    <span style={timeMutedStyle}>/</span>
                    <span style={timeMutedStyle}>{formatTime(duration)}</span>
                  </div>
                ) : null}
              </div>

              <div style={rowGroupStyle}>
                <div style={volumeWrapStyle}>
                  <button type="button" onClick={toggleMute} style={iconButtonStyle} aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}>
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <div style={volumeRangeShellStyle}>
                    <div style={{ ...rangeTrackStyle, height: 6 }} />
                    <div style={rangeFillStyle(`${(isMuted ? 0 : volume) * 100}%`, 6)} />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      style={rangeStyle}
                      className="modern-video-range"
                      aria-label="Volume"
                    />
                  </div>
                </div>

                <button type="button" onClick={restart} style={iconButtonStyle} aria-label="Restart video">
                  <RotateCcw size={16} />
                </button>

                <button type="button" onClick={toggleFullscreen} style={iconButtonStyle} aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}>
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
