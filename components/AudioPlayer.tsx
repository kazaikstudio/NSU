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
  artistGenre,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const waveId = useId();

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

  const handleRowClick = () => {

    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);

    if (nextExpanded && audioRef.current) {
      audioRef.current.dispatchEvent(new Event('play', { bubbles: true }));
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

  const audioTag = (
    <audio
      ref={audioRef}
      preload="metadata"
      src={src}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onPlay={() => setIsPlaying(true)}
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
    <div className="flex w-full items-center gap-3">
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause track' : 'Play track'}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 transition hover:bg-amber-300 focus:outline-none shadow-md shadow-amber-400/20"
      >
        {isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" className="ml-0.5" />}
      </button>

      <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
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
                    : 'bg-slate-800 group-hover:bg-slate-700'
                } ${isPlaying && isPassed ? 'animate-pulse' : ''}`}
                style={{ height: `${Math.max(20, height)}%` }}
              />
            );
          })}
        </div>
      </div>

      <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
        {formatTime(duration)}
      </span>
    </div>
  );

  if (!hasArtistDetails) {
    return (
      <div onClick={handleRowClick} className="cursor-pointer">
        {audioTag}
        {isExpanded ? player : <div className="text-white text-sm font-semibold">{title}</div>}
      </div>
    );
  }

  return (
    <article
      onClick={handleRowClick}
      className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 transition hover:border-amber-400/45 cursor-pointer"
    >
      {audioTag}

      {!isExpanded ? (
        <>
          <div className="min-w-0 shrink-0 basis-52">
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
            <p className="mt-1 truncate text-xs text-amber-300">{artistName} {artistGenre ? `• ${artistGenre}` : ''}</p>
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
        <a
          href={downloadUrl}
          download={fileName || `${title}.mp3`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:border-amber-300 hover:bg-amber-400/20"
          aria-label={`Download ${title}`}
        >
          <Download size={14} />
          <span className="hidden sm:inline">Download</span>
        </a>
      )}
    </article>
  );
}
