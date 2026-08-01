'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { Download, Pause, Play } from 'lucide-react';

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
  const [downloadProgress, setDownloadProgress] = useState(0);
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

    setDownloadProgress(0);
    setDownloadStatus('downloading');
    onDownload?.();

    const startProgress = () => {
      if (downloadTimerRef.current) {
        window.clearTimeout(downloadTimerRef.current);
      }

      const tick = () => {
        setDownloadProgress((previous) => {
          if (previous >= 92) {
            return previous;
          }
          return Math.min(92, previous + Math.max(2, Math.round((100 - previous) / 12)));
        });

        downloadTimerRef.current = window.setTimeout(tick, 180);
      };

      tick();
    };

    startProgress();

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const contentLength = Number(response.headers.get('Content-Length'));
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;

          chunks.push(value);
          receivedLength += value.byteLength;

          if (Number.isFinite(contentLength) && contentLength > 0) {
            setDownloadProgress((previous) => Math.max(previous, Math.min(98, Math.round((receivedLength / contentLength) * 100))));
          }
        }
      } else {
        const buffer = await response.arrayBuffer();
        chunks.push(new Uint8Array(buffer));
      }

      if (!chunks.length) {
        throw new Error('The download stream was empty.');
      }

      setDownloadProgress(100);
      const blobParts = chunks.map((chunk) => {
        const copiedChunk = new Uint8Array(chunk.byteLength);
        copiedChunk.set(chunk);
        return copiedChunk;
      });
      const blob = new Blob(blobParts, { type: response.headers.get('Content-Type') || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName || `${title}.mp3`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      setDownloadStatus('done');
      downloadTimerRef.current = window.setTimeout(() => {
        setDownloadStatus('idle');
        setDownloadProgress(0);
      }, 1200);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadStatus('error');
      setDownloadProgress(0);
      downloadTimerRef.current = window.setTimeout(() => {
        setDownloadStatus('idle');
      }, 1600);
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
    <div className="flex w-full items-center gap-3 text-Eltext1">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause track' : 'Play track'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-cardcl transition hover:bg-amber-300 focus:outline-none shadow-md shadow-amber-400/20"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
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

            <div className="flex w-full items-center gap-0.75 h-7">
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
        {isExpanded ? player : <div className="text-Eltext1 text-sm  font-semibold">{title}</div>}
      </div>
    );
  }

  return (
      <article
        onClick={handleRowClick}
      className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-card1/5
        bg-mrow/60 px-4 py-3 transition hover:border-amber-400/45 cursor-pointer text-Eltext1"
      >
        {audioTag}

        {!isExpanded ? (
          <>
            <div className="min-w-0 shrink-0 basis-60 sm:basis-auto">
              <h2 className="truncate text-xs sm:text-base font-semibold text-Eltext1">{title}</h2>
            </div>
            <div className="flex-1" />
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              {player}
            </div>
          </>
        )}

        {downloadUrl && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <a
              href={downloadUrl}
              download={fileName || `${title}.mp3`}
              onClick={handleDownloadClick}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30
                bg-amber-400/10 px-3 py-2 text-xs font-semibold text-Eltext1 transition hover:border-amber-300 hover:bg-amber-400/20"
              aria-label={`Download ${title}`}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{downloadStatus === 'downloading' ? 'Downloading…' : downloadStatus === 'done' ? 'Saved' : 'Download'}</span>
            </a>
            {downloadStatus === 'downloading' && (
              <div className="w-[96px] sm:w-[120px]">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-amber-400 transition-[width] duration-150" style={{ width: `${downloadProgress}%` }} />
                </div>
                <p className="mt-1 text-[10px] font-medium text-amber-400/85">{downloadProgress > 0 ? `${downloadProgress}%` : 'Preparing…'}</p>
              </div>
            )}
          </div>
        )}
      </article>
    );
}
