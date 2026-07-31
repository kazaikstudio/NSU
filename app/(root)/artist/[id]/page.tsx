'use client';

import Link from 'next/link';
import { ArrowLeft, Headphones, Users, Disc, Radio, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AudioPlayer from '@/components/AudioPlayer';

interface Artist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: string;
  bio: string;
  followers: number;
  monthlyListeners: number;
  bannerUrl?: string | null;
  profileUrl?: string | null;
}

interface Track {
  id: string;
  title: string;
  album?: string | null;
  fileName: string;
  fileUrl?: string;
  createdAt?: string;
}

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

export default function PublicArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadArtist = async () => {
      try {
        const artistResponse = await fetch(`/api/dashboard/artists/${params.id}`);
        const artistData = await artistResponse.json();
        if (!artistResponse.ok || !artistData.artist) throw new Error('Artist not found');

        const mediaResponse = await fetch(`/api/dashboard/artists/${params.id}/media`);
        const mediaData = mediaResponse.ok ? await mediaResponse.json() : { media: [] };

        if (!cancelled) {
          setArtist(artistData.artist);
          setTracks((mediaData.media || []).filter((media: Track & { kind?: string }) => media.kind === 'track'));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load artist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (params.id) void loadArtist();
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <span>Loading artist profile...</span>
        </div>
      </main>
    );
  }

  if (error || !artist) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-sm text-slate-400">{error || 'Artist not found'}</p>
        <Link href="/Audio" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 shadow-lg shadow-amber-400/20">
          <ArrowLeft size={16} /> Back to Audio
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-24 text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      {/* Background ambient lighting effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-yellow-600/10 blur-[150px]" />
      </div>

      {/* Hero Header Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px]"
          style={{ backgroundImage: artist.bannerUrl ? `url(${artist.bannerUrl})` : undefined }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-slate-950/60 via-slate-950/85 to-slate-950" />

        <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
          <Link href="/Audio" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-amber-300 mb-8">
            <ArrowLeft size={16} /> Back to Audio
          </Link>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:gap-8">
            <div
              className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-2 border-amber-400/30 bg-amber-400/10 text-5xl font-black text-amber-300 shadow-2xl shadow-black/50 sm:h-44 sm:w-44"
              style={artist.profileUrl ? { backgroundImage: `url(${artist.profileUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              role={artist.profileUrl ? 'img' : undefined}
              aria-label={artist.profileUrl ? `${artist.name} profile` : undefined}
            >
              {!artist.profileUrl && artist.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 shadow-sm backdrop-blur-md mb-3">
                <Sparkles size={12} />
                <span>{artist.status} artist</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl bg-linear-to-r from-white via-slate-100 to-amber-200 bg-clip-text ">
                {artist.name}
              </h1>
              <p className="mt-2 text-base font-medium text-amber-400/90 flex items-center gap-2">
                <Radio size={15} />
                {artist.genre}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Single-Column Full-Width Content Layout */}
      <div className="relative mx-auto max-w-8xl px-4 py-4 sm:px-6 space-y-3 ">

        {/* Quick Metrics Bar - 3 Columns on both Mobile and Desktop */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 sm:p-5 backdrop-blur-md transition hover:border-amber-400/30">
            <p className="text-lg sm:text-2xl font-black text-white">{artist.tracksCount || tracks.length}</p>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-400 flex items-center gap-1.5 truncate">
              <Disc size={13} className="shrink-0 text-amber-400" /> <span className="truncate">Total Tracks</span>
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 sm:p-5 backdrop-blur-md transition hover:border-amber-400/30">
            <p className="text-lg sm:text-2xl font-black text-white">{formatNumber(artist.followers)}</p>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-400 flex items-center gap-1.5 truncate">
              <Users size={13} className="shrink-0 text-amber-400" /> <span className="truncate">Followers</span>
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3.5 sm:p-5 backdrop-blur-md transition hover:border-amber-400/30">
            <p className="text-lg sm:text-2xl font-black text-white">{formatNumber(artist.monthlyListeners)}</p>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-400 flex items-center gap-1.5 truncate">
              <Headphones size={13} className="shrink-0 text-amber-400" /> <span className="truncate">Monthly Listeners</span>
            </p>
          </div>
        </div>

        {/* Released Tracks Section */}
        <div>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Released Tracks</h2>
              <p className="mt-1 text-xs text-slate-400">Listen to music uploaded by Noll Studio.</p>
            </div>
            <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
              {tracks.length} available
            </span>
          </div>

          {tracks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 px-6 py-16 text-center text-sm text-slate-500">
              No uploaded tracks available yet.
            </div>
          ) : (
            <div className="space-y-4">
              {tracks.map((track) => {
                if (!track.fileUrl) {
                  return (
                    <div key={track.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-500">
                      {track.title}: Audio unavailable
                    </div>
                  );
                }

                return (
                  <AudioPlayer
                    key={track.id}
                    src={getPlayableAudioUrl(track.fileUrl)}
                    fileUrl={track.fileUrl}
                    title={track.title}
                    album={track.album}
                    fileName={track.fileName}
                    createdAt={track.createdAt}
                    artistName={artist.name}
                    artistGenre={artist.genre}
                  />
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
