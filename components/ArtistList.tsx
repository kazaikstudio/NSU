'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

  useEffect(() => {
    let cancelled = false;

    const loadArtists = async () => {
      try {
        const response = await fetch('/api/artists');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load artists');
        if (!cancelled) setArtists(data.artists || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load artists');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadArtists();
    return () => { cancelled = true; };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredArtists = artists.filter((artist) =>
    `${artist.name} ${artist.genre}`.toLowerCase().includes(normalizedSearch)
  );

  if (loading) return <p className="col-span-full py-16 text-center text-sm text-slate-400">Loading artists...</p>;
  if (error) return <p className="col-span-full py-16 text-center text-sm text-red-400">{error}</p>;
  if (filteredArtists.length === 0) {
    return <p className="col-span-full py-16 text-center text-sm text-slate-400">No registered artists match your search.</p>;
  }

  return (
    <div className="col-span-full grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-2 text-primary">
          {filteredArtists.map((artist) => (
            <Link href={`/artist/${encodeURIComponent(artist.id)}`} key={artist.id} className="flex items-center gap-4 rounded-xl  bg-mrow/70 p-4 transition hover:border-amber-400/40">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-amber-400/30 bg-amber-400/10">
                {artist.profileUrl ? (
                  <div
                    role="img"
                    aria-label={`${artist.name} profile`}
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${artist.profileUrl})` }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-lg font-bold text-amber-300">{artist.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-Eltext1">{artist.name}</h2>
                <p className="mt-1 text-xs text-amber-400">{artist.genre}</p>
                <p className="mt-1 text-xs text-Eltext1/80">{artist.tracksCount} uploaded track{artist.tracksCount === 1 ? '' : 's'} • {artist.status}</p>
              </div>
            </Link>
          ))}
        </div>
  );
}

