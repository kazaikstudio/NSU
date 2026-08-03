'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import { getDownloadPath } from '@/lib/download';

interface DownloadNoticePayload {
  status: 'downloading' | 'done' | 'error';
  title: string;
}

interface AudioPlayerProps {
  src: string;
  title: string;
  fileUrl?: string;
  album?: string | null;
  fileName?: string;
  createdAt?: string;
  artistName?: string;
  artistGenre?: string | null;
  onPlay?: () => void;
  onDownload?: () => void;
}

function formatTime(time: number) {
  if (!Number.isFinite(time)) return '0:00';

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getDownloadUrl(fileUrl: string | undefined, fileName: string | undefined, title: string) {
  if (!fileUrl) return undefined;

  const match = fileUrl.match(/[?&]id=([^&]+)/);
  if (!match?.[1]) return fileUrl;

  return `/api/dashboard/media/${match[1]}?download=1&filename=${encodeURIComponent(fileName || `${title}.mp3`)}`;
}

export default function AudioPlayer({
  src,
  title,
  fileUrl,
  fileName,
  artistName,
  onPlay,
  onDownload,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const waveId = useId();
  const downloadTimerRef = useRef<number | null>(null);

  // Pseudo-random wave bar heights to simulate an equalizer visualizer
  const waveBars = [
    40, 75, 30, 90, 60, 100, 45, 80, 35, 95,
    55, 85, 40, 70, 90, 30, 85, 65, 100, 45,
    75, 50, 90, 35, 80, 60, 95, 40, 70, 85
  ];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.load();
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsExpanded(false);
  }, [src]);

  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        window.clearTimeout(downloadTimerRef.current);
      }
    };
  }, []);

  // Global event listener to pause this audio and collapse it back to default when another row/player starts playing
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const audio = audioRef.current;
      if (audio && e.target !== audio) {
        audio.pause();
        setIsPlaying(false);
        setIsExpanded(false);
      }
    };

    window.addEventListener('play', handleGlobalPlay, true);
    return () => {
      window.removeEventListener('play', handleGlobalPlay, true);
    };
  }, []);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Play failed:", err);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleRowClick = async () => {
    const audio = audioRef.current;
    setIsExpanded(true);

    if (!audio || !audio.paused) return;

    try {
      await audio.play();
    } catch (err) {
      console.error('Play failed:', err);
    }
  };

  const seek = (value: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const downloadUrl = getDownloadUrl(fileUrl, fileName, title);
  const hasArtistDetails = Boolean(artistName);

  const handleDownloadClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!downloadUrl) return;

    if (downloadTimerRef.current) {
      window.clearTimeout(downloadTimerRef.current);
    }

    setDownloadStatus('downloading');
    window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
      detail: { status: 'downloading', title },
    }));
    onDownload?.();

    try {
      const filename = getDownloadPath(fileName || `${title}.mp3`, 'audio');
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setDownloadStatus('done');
      window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
        detail: { status: 'done', title },
      }));
      downloadTimerRef.current = window.setTimeout(() => {
        setDownloadStatus('idle');
      }, 1800);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus('error');
      window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
        detail: { status: 'error', title },
      }));
      downloadTimerRef.current = window.setTimeout(() => {
        setDownloadStatus('idle');
      }, 2200);
    }
  };

  const audioTag = (
    <audio
      ref={audioRef}
      preload="metadata"
      src={src}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => {
        setIsPlaying(true);
        onPlay?.();
      }}
      onPause={() => setIsPlaying(false)}
      onEnded={() => {
        setIsPlaying(false);
        setCurrentTime(0);
      }}
      className="sr-only"
      aria-label={`Audio player for ${title}`}
    />
  );

  const player = (
    <div className="flex w-full items-center gap-2 xs:gap-3 text-Eltext1 min-w-0">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause track' : 'Play track'}
        className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-cardcl transition hover:bg-amber-300 focus:outline-none shadow-md shadow-amber-400/20 cursor-pointer"
        >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      <span className="shrink-0 text-[10px] font-medium tabular-nums text-Eltext1">
        {formatTime(currentTime)}
      </span>

      {/* Interactive Waveform Bar Visualizer */}
      <div className="relative min-w-0 flex-1 group py-2 cursor-pointer flex items-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Track progress"
          className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
        />

        <div className="flex w-full items-center gap-0.5 sm:gap-0.75 h-7">
          {waveBars.map((height, index) => {
            const barPosition = (index / waveBars.length) * 100;
            const isPassed = barPosition <= progressPercent;

            return (
              <div
                key={`${waveId}-${index}`}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPassed
                    ? 'bg-amber-400 shadow-sm shadow-amber-400/30'
                    : 'bg-Eltext1/60 group-hover:bg-card1/40'
                } ${isPlaying && isPassed ? 'animate-pulse' : ''}`}
                style={{ height: `${Math.max(20, height)}%` }}
              />
            );
          })}
        </div>
      </div>

      <span className="shrink-0 text-[10px] font-medium tabular-nums text-Eltext1">
        {formatTime(duration)}
      </span>
    </div>
  );

  if (!hasArtistDetails) {
    return (
      <div onClick={handleRowClick} className="cursor-pointer">
        {audioTag}
        {isExpanded ? player : <div className="text-Eltext1 text-sm font-semibold truncate">{title}</div>}
      </div>
    );
  }

  return (
    <article
      onClick={handleRowClick}
      className="flex min-w-0 items-center justify-between gap-2 sm:gap-4 rounded-lg border border-card1/5 bg-mrow/60 px-3 py-2.5 transition hover:border-amber-400/45 cursor-pointer text-Eltext1 sm:px-4 sm:py-3"
    >
      {audioTag}

      {!isExpanded ? (
        <>
          <div className="min-w-0 flex-1">
            <div className="flex items-center min-w-0">
              <span className="truncate text-xs font-semibold text-Eltext1 sm:text-sm">
                {title}
              </span>
            </div>

          </div>
        </>
      ) : (
        <div className="min-w-0 flex-1">
          {player}
        </div>
      )}

      {downloadUrl && (
        <a
          href={downloadUrl}
          download={fileName || `${title}.mp3`}
          onClick={handleDownloadClick}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[11px] font-semibold text-Eltext1 transition hover:border-amber-300 hover:bg-amber-400/20 sm:px-3 cursor-pointer"
          aria-label={`Download ${title}`}
        >
          <Download size={14} />
          <span className="hidden sm:inline">
            {downloadStatus === 'downloading' ? 'Downloading…' : downloadStatus === 'done' ? 'Saved' : 'Download'}
          </span>
        </a>
      )}
    </article>
  );
}
