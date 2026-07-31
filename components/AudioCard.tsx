import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  return (
    <article
      className="group flex h-full cursor-pointer flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 shadow-xl backdrop-blur-xl transition hover:border-amber-400/50"
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
        className="group relative flex aspect-4/4 sm:aspect-3/3 w-full items-end justify-between overflow-hidden rounded-xl border border-white bg-slate-900 bg-cover bg-center p-4 transition-all duration-300 hover:border-amber-400/50 hover:shadow-xl hover:shadow-amber-400/10"
        style={track.artistProfileUrl ? { backgroundImage: `url(${track.artistProfileUrl})` } : undefined}
        role={track.artistProfileUrl ? 'img' : undefined}
        aria-label={track.artistProfileUrl ? `${track.artistName} profile` : undefined}
      >
        {!track.artistProfileUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-slate-900 to-slate-950">
            <span className="text-5xl font-black text-amber-400/80 drop-shadow-md">
              {track.artistName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Cinematic gradient overlays */}
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/30 to-transparent transition-opacity duration-300 group-hover:from-slate-950/95" />
        <div className="absolute inset-0 bg-amber-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Top badge */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-400/30 bg-slate-950/60 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-300 backdrop-blur-md shadow-sm">
            Latest upload #{index + 1}
          </span>
        </div>

        {/* Play/Pause overlay button */}
        <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 transition-all duration-300 transform scale-95 group-hover:opacity-100 group-hover:scale-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/30 transition-transform hover:scale-105 active:scale-95">
            {isPlaying ? (
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            ) : (
              <svg className="h-5 w-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M5 3.868v16.264a1 1 0 0 0 1.555.832l12.5-8.132a1 1 0 0 0 0-1.664l-12.5-8.132A1 1 0 0 0 5 3.868z" /></svg>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-3">
        <div className="min-w-0 space-y-1 px-1 text-left">
          <h3 className="truncate text-sm font-bold text-white sm:text-base">{track.title}</h3>
          <p className="truncate text-[11px] text-amber-300">{track.artistName}</p>
        </div>
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
