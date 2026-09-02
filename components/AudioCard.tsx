import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';

export interface FeaturedAudioTrack {
  id: string;
  title: string;
  album?: string | null;
  fileUrl: string;
  artistName: string;
  artistProfileUrl?: string | null;
}

interface AudioCardProps {
  track: FeaturedAudioTrack;
  index?: number;
  isPlaying: boolean;
  onToggle: () => void;
  onEnded: () => void;
}

export default function AudioCard({ track, index = 0, isPlaying, onToggle, onEnded }: AudioCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  function getDownloadUrl(fileUrl: string | undefined) {
    if (!fileUrl) return undefined;

    const match = fileUrl.match(/[?&]id=([^&]+)/);
    if (!match?.[1]) return fileUrl;

    return `/api/dashboard/media/${match[1]}?download=1&filename=${encodeURIComponent(`${track.title}.mp3`)}`;
  }

  function normalizeImageUrl(url?: string | null) {
    if (!url) return undefined;
    try {
      // If it's a Google Drive file link, convert to thumbnail endpoint
      const driveFileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = driveFileMatch ? (driveFileMatch[1] || driveFileMatch[2]) : null;
      if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
      return url;
    } catch {
      return url;
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const handleDownloadClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const downloadUrl = getDownloadUrl(track.fileUrl);
    if (!downloadUrl) return;

    window.dispatchEvent(new CustomEvent('nsu-download-status', {
      detail: { status: 'downloading', title: track.title, progress: 0, downloadedBytes: 0 },
    }));

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Download body is unavailable.');

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

  return (
      <article
        className="group flex h-full cursor-pointer flex-col rounded-xl border border-card1/25 bg-cardcl/60 p-2 shadow-xl backdrop-blur-xl transition hover:border-amber-400/50 text-primary"
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${isPlaying ? 'Pause' : 'Play'} ${track.title} by ${track.artistName}`}
      >
        <div
          className="group relative flex aspect-4/4 sm:aspect-3/3 w-full items-end justify-between overflow-hidden rounded-xl border border-card1/20 bg-cardcl bg-cover bg-center p-4 transition-all duration-300 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-400/10"
            style={track.artistProfileUrl ? { backgroundImage: `url(${normalizeImageUrl(track.artistProfileUrl)})` } : undefined}
            role={track.artistProfileUrl ? 'img' : undefined}
            aria-label={track.artistProfileUrl ? `${track.artistName} profile` : undefined}
        >
          {!track.artistProfileUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-cardcl to-card1/80">
              <span className="text-5xl font-black text-amber-400/80 drop-shadow-md">
                {track.artistName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Top badge */}
          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-400/30 bg-cardcl/60 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400 backdrop-blur-md shadow-sm">
              Latest upload #{index + 1}
            </span>
          </div>

          {/* Play/Pause overlay button */}
          <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 transition-all duration-300 transform scale-95 group-hover:opacity-100 group-hover:scale-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-cardcl shadow-lg shadow-amber-400/30 transition-transform hover:scale-105 active:scale-95">
              {isPlaying ? (
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg className="h-5 w-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M5 3.868v16.264a1 1 0 0 0 1.555.832l12.5-8.132a1 1 0 0 0 0-1.664l-12.5-8.132A1 1 0 0 0 5 3.868z" /></svg>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 space-y-1 px-1 text-left">
            <h3 className="truncate text-sm font-bold text-primary sm:text-base">{track.title}</h3>
            <p className="truncate text-[11px] text-amber-400">{track.artistName}</p>
          </div>

          <button
            type="button"
            onClick={handleDownloadClick}
            aria-label={`Download ${track.title}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-400 transition hover:border-amber-300 hover:bg-amber-400/20 active:scale-95"
          >
            <Download size={16} />
          </button>
        </div>

        <audio
          ref={audioRef}
          src={track.fileUrl}
          preload="metadata"
          className="sr-only"
          onEnded={onEnded}
          aria-label={`${track.title} audio`}
        />
      </article>
    );
}
