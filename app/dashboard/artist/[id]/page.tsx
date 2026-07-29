'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { artistsSeed } from '@/lib/artists';

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const artist = useMemo(() => artistsSeed.find((item) => item.id === params.id), [params.id]);

  if (!artist) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
          <h1 className="text-2xl font-semibold">Artist not found</h1>
          <p className="mt-2 text-sm text-slate-400">The selected artist could not be found.</p>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300">
          ← Back to dashboard
        </Link>

        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-indigo-400">Artist Profile</p>
            <h1 className="mt-2 text-3xl font-semibold">{artist.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">{artist.bio}</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-4">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-1 text-lg font-medium">{artist.status}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Genre</p>
            <p className="mt-2 text-lg font-medium">{artist.genre}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Tracks</p>
            <p className="mt-2 text-lg font-medium">{artist.tracksCount}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Monthly listeners</p>
            <p className="mt-2 text-lg font-medium">{artist.monthlyListeners.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Featured track</p>
            <p className="mt-2 text-lg font-medium">{artist.featuredTrack}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-sm text-slate-400">Followers</p>
            <p className="mt-2 text-lg font-medium">{artist.followers.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
