'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import { getAudioDownloadThumbnailUrl, getDownloadPath } from '@/lib/download';
import { registerClientDownload } from '@/lib/download-controls';

interface DownloadNoticePayload {
  status: 'downloading' | 'done' | 'error';
  title: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
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
  downloadCount?: number;
  showDownload?: boolean;
  thumbnailUrl?: string;
  onPlay?: () => void;
  onDownload?: (downloadCount?: number) => void;
  onNext?: () => void;
}

function getDownloadUrl(fileUrl: string | undefined, fileName: string | undefined, title: string) {
  if (!fileUrl) return undefined;

  const match = fileUrl.match(/\/media\/([a-zA-Z0-9_-]+)(?:[/?#]|$)|[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = match?.[1] || match?.[2];
  if (!fileId) return fileUrl;

  return `/api/dashboard/media/${fileId}?download=1&filename=${encodeURIComponent(fileName || `${title}.mp3`)}`;
}

async function getDownloadRegion() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

  const position = await new Promise<GeolocationPosition | undefined>((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(undefined), {
      enableHighAccuracy: false,
      timeout: 4000,
      maximumAge: 300000,
    });
  });
  if (!position) return undefined;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return undefined;

    const data = await response.json() as { address?: Record<string, string | undefined> };
    const addressText = Object.values(data.address || {}).filter(Boolean).join(' ').toLowerCase();
    if (addressText.includes('kampala')) return 'Kampala';
    if (/(northern|gulu|lira|kitgum|west nile|arua|karamoja|moroto)/.test(addressText)) return 'Northern';
    if (/(eastern|jinja|mbale|tororo|soroti|busia)/.test(addressText)) return 'Eastern';
    if (/(western|mbarara|kasese|fort portal|kabale|hoima)/.test(addressText)) return 'Western';
    if (/(central|wakiso|mukono|mpigi|masaka|masindi)/.test(addressText)) return 'Central';
  } catch {
    return undefined;
  }

  return undefined;
}

export default function AudioPlayer({
  src,
  title,
  fileUrl,
  fileName,
  artistName,
  thumbnailUrl,
  showDownload = true,
  onPlay,
  onDownload,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  const downloadTimerRef = useRef<number | null>(null);
  const downloadProgressRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.load();
    setIsPlaying(false);
    setIsExpanded(false);
  }, [src]);

  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        window.clearTimeout(downloadTimerRef.current);
      }
      if (downloadProgressRef.current) {
        downloadProgressRef.current = 0;
      }
    };
  }, []);

  // Pause this player when another audio element starts playing
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
        console.error('Play failed:', err);
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
    downloadProgressRef.current = 8;
    window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
      detail: { status: 'downloading', title, progress: 0, downloadedBytes: 0 },
    }));

    const progressSteps = [12, 24, 38, 52, 68, 82, 92];
    let progressIndex = 0;
    const progressTimer = window.setInterval(() => {
      const nextProgress = progressSteps[progressIndex] ?? 94;
      progressIndex += 1;
      downloadProgressRef.current = nextProgress;
      window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
        detail: { status: 'downloading', title, progress: nextProgress },
      }));
    }, 180);

    const controller = new AbortController();
    const downloadControl = registerClientDownload(title, () => controller.abort());

    try {
      const region = await getDownloadRegion();
      const requestUrl = new URL(downloadUrl, window.location.origin);
      if (region) requestUrl.searchParams.set('region', region);
      const response = await fetch(requestUrl, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const serverDownloadCount = Number(response.headers.get('X-NSU-Download-Count'));

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
            downloadProgressRef.current = nextProgress;
            setDownloadStatus('downloading');
            window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
              detail: { status: 'downloading', title, progress: nextProgress, downloadedBytes: loaded, totalBytes: total },
            }));
          }
        }
      }

      const binaryData = chunks.map((chunk) => {
        const array = new Uint8Array(chunk.length);
        array.set(chunk);
        return array.buffer.slice(array.byteOffset, array.byteOffset + array.byteLength);
      });
      const blob = new Blob(binaryData, { type: 'audio/mpeg' });
      const filename = getDownloadPath(fileName || `${title}.mp3`, 'audio');
      const anchor = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.dataset.thumbnailUrl = getAudioDownloadThumbnailUrl();
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      onDownload?.(Number.isFinite(serverDownloadCount) ? serverDownloadCount : undefined);

      window.clearInterval(progressTimer);
      downloadProgressRef.current = 100;
      setDownloadStatus('done');
      window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
        detail: { status: 'done', title, progress: 100, downloadedBytes: loaded, totalBytes: total || loaded },
      }));
      downloadTimerRef.current = window.setTimeout(() => {
        setDownloadStatus('idle');
      }, 1800);
    } catch (error) {
      if (downloadControl.isCancelled() || (error instanceof Error && error.name === 'AbortError')) return;
      console.error('Download failed:', error);
      window.clearInterval(progressTimer);
      setDownloadStatus('error');
      window.dispatchEvent(new CustomEvent<DownloadNoticePayload>('nsu-download-status', {
        detail: { status: 'error', title, progress: downloadProgressRef.current },
      }));
      downloadTimerRef.current = window.setTimeout(() => {
        setDownloadStatus('idle');
      }, 2200);
    } finally {
      downloadControl.unregister();
    }
  };

  const audioTag = (
    <audio
      ref={audioRef}
      preload="metadata"
      src={src}
      onPlay={() => {
        setIsPlaying(true);
        onPlay?.();
      }}
      onPause={() => setIsPlaying(false)}
      onEnded={() => setIsPlaying(false)}
      className="sr-only"
      aria-label={`Audio player for ${title}`}
    />
  );

  const playButton = (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={isPlaying ? 'Pause track' : 'Play track'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white transition-all duration-200 hover:bg-amber-300 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer ${
        isPlaying ? 'shadow-lg shadow-amber-400/50' : 'shadow-md shadow-amber-400/20'
      }`}
    >
      {isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" className="ml-0.5" />}
    </button>
  );

  if (!hasArtistDetails) {
    return (
      <div onClick={handleRowClick} className="cursor-pointer">
        {audioTag}
        {isExpanded ? playButton : <div className="text-Eltext1 text-sm font-semibold truncate">{title}</div>}
      </div>
    );
  }

  return (
    <article
      onClick={handleRowClick}
      className="group relative flex min-w-0 items-center gap-3 sm:gap-3 px-3 py-2.5 transition cursor-pointer text-Eltext1 sm:px-4 sm:py-3 border-b border-card1/10"
      >
      {/* Active gradient overlay — fades left-to-right when playing */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-linear-to-r from-amber-400/20 to-transparent transition-opacity duration-300 group-hover:opacity-100 ${
          isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {audioTag}

      {/* Thumbnail */}
      <div className="shrink-0 h-10 w-10 sm:h-11 sm:w-11 rounded-md overflow-hidden bg-mrow/60 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl || '/noll.jpg'}
          alt={thumbnailUrl ? title : 'Default music thumbnail'}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Title */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-Eltext1 sm:text-sm">
          {title}
        </span>
      </div>


      {/* Play / Pause button */}
      {playButton}

      {/* Download button */}
      {showDownload && downloadUrl && (
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
