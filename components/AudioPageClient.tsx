"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Switchbutton from './Switchbutton';
import { getClientCachedData } from '@/lib/client-cache';

const FeaturedAudioCards = dynamic(() => import('./FeaturedAudioCards'), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-slate-400">Loading audio experience...</p>,
});

const AudioTrackList = dynamic(() => import('./AudioTrackList'), {
  ssr: false,
  loading: () => <p className="col-span-full py-10 text-center text-sm text-slate-400">Loading music library...</p>,
});

const ArtistList = dynamic(() => import('./ArtistList'), {
  ssr: false,
  loading: () => <p className="col-span-full py-10 text-center text-sm text-slate-400">Loading artists...</p>,
});

const TrendingCard = dynamic(() => import('./TrendingCard'), {
  ssr: false,
  loading: () => <div className="my-4 h-16 rounded-2xl border border-card1/10 bg-cardcl/50" />,
});

interface DashboardArtist {
  id: string;
  name: string;
  profileUrl?: string | null;
  totalDownloads?: number;
}

interface TrendingArtist {
  id: string;
  name: string;
  avatarUrl: string;
  downloads: number;
}

export default function AudioPageClient() {
  const [searchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'music' | 'artist'>('music');
  const [topArtists, setTopArtists] = useState<TrendingArtist[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getClientCachedData('dashboard-artists', async () => {
          const res = await fetch('/api/dashboard/artists');
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || 'Failed to load dashboard artists');
          return payload;
        });
        const mapped: TrendingArtist[] = (data.artists as DashboardArtist[] || []).map((artist) => ({
          id: artist.id,
          name: artist.name,
          avatarUrl: artist.profileUrl || '',
          downloads: Number(artist.totalDownloads || 0),
        }));
        if (mapped.length > 0) {
          const ranked = [...mapped].sort((left, right) => right.downloads - left.downloads);
          if (!cancelled) setTopArtists(ranked.slice(0, 5));
        } else {
          if (!cancelled) setTopArtists([]);
        }
      } catch (err) {
        console.warn('Unable to load dashboard artists', err);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="px-4 mb-10 py-5 max-w-9xl mx-auto text-primary">
      <Switchbutton searchHref="/search" />

      <FeaturedAudioCards />

      <p className="relative mt-6 rounded-2xl border border-amber-400/20 bg-cardcl/40 p-4 text-center text-sm font-medium text-secondry shadow-lg shadow-black/5 backdrop-blur-xl md:text-left">
        <span className="absolute -top-3 left-4 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-0.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase shadow-sm">
          🔥 Hot & Fresh
        </span>
        <span className="text-xs sm:text-sm md:text-base text-muted-foreground leading-relaxed">
          Exploring the latest audio emerging from Noll Studio Ug
          <span className="hidden sm:inline">anda and visual creations.</span>
        </span>
      </p>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none [-ms-overflow-style:none][&::-webkit-scrollbar]:hidden">
        {topArtists.length > 0 ? (
          topArtists.map((artist, index) => (
            <div key={artist.id} className="snap-start shrink-0">
              <TrendingCard artist={artist} isTop={index === 0} />
            </div>
          ))
        ) : (
          <div className="snap-start shrink-0">
            <TrendingCard />
          </div>
        )}
      </div>

      <div className="flex items-center w-full mt-2 bg-cardcl/80 p-1.5 rounded-2xl border border-card1/20">
        <button
          onClick={() => setActiveTab('music')}
          type="button"
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'music'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-secondry hover:text-primary hover:bg-card1/10'
          }`}
        >
          All Music
        </button>
        <button
          onClick={() => setActiveTab('artist')}
          type="button"
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'artist'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-secondry hover:text-primary hover:bg-card1/10'
          }`}
        >
          All Artist
        </button>
      </div>

      <div className="mt-1 max-w-8xl mx-auto">
        {activeTab === 'music' ? (
          <div id="music-list-container" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full">
            <AudioTrackList searchTerm={searchTerm} />
          </div>
        ) : (
          <div id="artist-list-container" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full">
            <ArtistList searchTerm={searchTerm} />
          </div>
        )}
      </div>
    </main>
  );
}
