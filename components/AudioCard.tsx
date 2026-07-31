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
  isPlaying: boolean;
  onToggle: () => void;
  onEnded: () => void;
}

export default function AudioCard({ track, isPlaying, onToggle, onEnded }: AudioCardProps) {
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
      className="group my-6 flex h-full cursor-pointer flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 shadow-xl backdrop-blur-xl transition hover:border-amber-400/50"
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
        className="relative flex aspect-video w-full items-end overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-800 bg-cover bg-center p-3"
        style={track.artistProfileUrl ? { backgroundImage: `url(${track.artistProfileUrl})` } : undefined}
        role={track.artistProfileUrl ? 'img' : undefined}
        aria-label={track.artistProfileUrl ? `${track.artistName} profile` : undefined}
      >
        {!track.artistProfileUrl && <span className="text-4xl font-bold text-amber-300">{track.artistName.charAt(0).toUpperCase()}</span>}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />
        <span className="relative rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">Latest upload</span>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
          {isPlaying ? 'Pause' : 'Play'}
        </span>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-amber-300 bg-cover bg-center text-lg font-bold text-black"
          style={track.artistProfileUrl ? { backgroundImage: `url(${track.artistProfileUrl})` } : undefined}
        >
          {!track.artistProfileUrl && track.artistName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 space-y-1 px-1 text-left">
          <h3 className="truncate text-sm font-bold text-white sm:text-base">{track.title}</h3>
          <p className="truncate text-[11px] text-amber-300">{track.artistName}</p>
          <p className="truncate text-[11px] text-zinc-400">{track.album || 'Single'}</p>
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
