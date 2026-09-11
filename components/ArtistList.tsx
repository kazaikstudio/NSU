'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Mic2, Music } from 'lucide-react';
import { getClientCachedData } from '@/lib/client-cache';

interface RegisteredArtist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: string;
  profileUrl?: string | null;
}

export default function ArtistList({ searchTerm }: { searchTerm: string }) {
  const [artists, setArtists] = useState<RegisteredArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadArtists = async () => {
      try {
        const response = await fetch('/api/dashboard/artists', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load artists');
        if (cancelled) return;
        if (!Array.isArray(data.artists)) return;
        loadedOnceRef.current = true;
        setError('');
        setArtists((prev: RegisteredArtist[]) => {
          const byId = new Map(prev.map((artist) => [artist.id, artist]));
          const hasChanges =
            prev.length !== data.artists.length ||
            (data.artists as RegisteredArtist[]).some((artist) => {
              const current = byId.get(artist.id);
              return (
                !current ||
                current.name !== artist.name ||
                current.genre !== artist.genre ||
                current.tracksCount !== artist.tracksCount ||
                current.status !== artist.status ||
                current.profileUrl !== artist.profileUrl
              );
            });
          return hasChanges ? (data.artists as RegisteredArtist[]) : prev;
        });
      } catch (loadError) {
        if (!cancelled && !loadedOnceRef.current) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load artists');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadArtists();
    const interval = window.setInterval(loadArtists, 30000);
    const handleFocus = () => void loadArtists();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredArtists = artists.filter((artist) =>
    `${artist.name} ${artist.genre}`.toLowerCase().includes(normalizedSearch)
  );

  const preloadArtist = (artistId: string) => {
    void Promise.all([
      getClientCachedData(`artist:${artistId}`, async () => {
        const response = await fetch(`/api/dashboard/artists/${encodeURIComponent(artistId)}`);
        if (!response.ok) throw new Error('Unable to preload artist');
        return response.json();
      }),
      getClientCachedData(`artist-media:${artistId}`, async () => {
        const response = await fetch(`/api/dashboard/artists/${encodeURIComponent(artistId)}/media`);
        if (!response.ok) throw new Error('Unable to preload artist media');
        return response.json();
      }),
    ]).catch(() => {});
  };

  if (loading) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-secondry/50">
        <Mic2 size={28} className="animate-pulse text-navlink/40" />
        <p className="text-sm">Loading artists…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center gap-2 py-16 text-red-400/80">
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (filteredArtists.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-secondry/50">
        <Mic2 size={28} className="text-secondry/25" />
        <p className="text-sm">No artists match your search.</p>
      </div>
    );
  }

  return (
    <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 p-1 gap-0.5">
      {filteredArtists.map((artist) => (
        <Link
          href={`/artist/${encodeURIComponent(artist.id)}`}
          key={artist.id}
          onMouseEnter={() => preloadArtist(artist.id)}
          onFocus={() => preloadArtist(artist.id)}
          className="group artist-card-gradient rounded-lg border border-card1/10 backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-navlink/30 hover:shadow-lg hover:shadow-navlink/5 hover:-translate-y-0.5 active:scale-[0.98]"
          >
          <div className="flex items-center gap-4 p-4">
          {/* Avatar */}
          <div className="relative h-20 w-20 shrink-0">
            <div className="h-full w-full overflow-hidden rounded-xl border border-white/10 shadow-lg shadow-black/20 ring-2 ring-transparent group-hover:ring-navlink/30 group-hover:shadow-navlink/20 transition-all duration-300">
              {artist.profileUrl ? (
                <div
                  role="img"
                  aria-label={`${artist.name} profile`}
                  className="h-full w-full bg-cover bg-center group-hover:scale-105 transition-transform duration-300"
                  style={{ backgroundImage: `url(${artist.profileUrl})` }}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-linear-to-br from-navlink/20 to-glow/20 text-xl font-bold text-navlink drop-shadow-sm">
                  {artist.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Status dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-cardcl shadow-sm transition-colors duration-200 ${
                artist.status.toLowerCase() === 'active'
                  ? 'bg-glow shadow-glow/40'
                  : 'bg-secondry/30'
              }`}
            />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm sm:text-base font-semibold text-primary group-hover:text-navlink transition-colors duration-150">
              {artist.name}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-glow/20 bg-glow/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-glow">
              <Music size={9} />
              {artist.genre}
            </span>
            <p className="mt-1.5 text-[11px] text-secondry/55">
              {artist.tracksCount} track{artist.tracksCount === 1 ? '' : 's'} · {artist.status}
            </p>
          </div>

          {/* Arrow */}
          <ChevronRight
            size={16}
            className="shrink-0 text-secondry/25 group-hover:text-navlink/60 group-hover:translate-x-0.5 transition-all duration-200"
          />
          </div>
        </Link>
      ))}
    </div>
  );
}
