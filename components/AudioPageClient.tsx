"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music2, Mic2, Search, Mic } from 'lucide-react';
import dynamic from 'next/dynamic';
import Switchbutton from './Switchbutton';
import ArtistList from './ArtistList';

const FeaturedAudioCards = dynamic(() => import('./FeaturedAudioCards'), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-sm text-slate-400">Loading audio experience...</p>,
});

const AudioTrackList = dynamic(() => import('./AudioTrackList'), {
  ssr: false,
  loading: () => <p className="col-span-full py-10 text-center text-sm text-slate-400">Loading music library...</p>,
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
  const [activeTab, setActiveTab] = useState<'music' | 'artist'>(() => {
    if (typeof window === 'undefined') return 'music';
    const stored = window.localStorage.getItem('nsu-active-tab');
    return stored === 'artist' ? 'artist' : 'music';
  });
  const [artistSearchTerm, setArtistSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('nsu-active-tab', activeTab);
    } catch {
      // ignore storage errors
    }
  }, [activeTab]);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      setArtistSearchTerm(e.results[0][0].transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);
  const [topArtists, setTopArtists] = useState<TrendingArtist[]>([]);
  const [musicCount, setMusicCount] = useState<number | null>(null);
  const [artistCount, setArtistCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadArtists = async () => {
      try {
        const res = await fetch('/api/dashboard/artists', { cache: 'no-store' });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Failed to load dashboard artists');

        const mapped: TrendingArtist[] = (payload.artists as DashboardArtist[] || []).map((artist) => ({
          id: artist.id,
          name: artist.name,
          avatarUrl: artist.profileUrl || '',
          downloads: Number(artist.totalDownloads || 0),
        }));

        if (cancelled) return;
        setArtistCount((payload.artists as DashboardArtist[] || []).length);
        const ranked = [...mapped].sort((left, right) => right.downloads - left.downloads);
        const next = ranked.slice(0, 5);
        setTopArtists((prev) => {
          const same =
            prev.length === next.length &&
            next.every((a, i) => a.id === prev[i].id && a.name === prev[i].name && a.avatarUrl === prev[i].avatarUrl && a.downloads === prev[i].downloads);
          return same ? prev : next;
        });
      } catch (err) {
        console.warn('Unable to load dashboard artists', err);
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

  useEffect(() => {
    let cancelled = false;

    const loadMusicCount = async () => {
      try {
        const response = await fetch('/api/audio', { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled) setMusicCount((data.tracks as unknown[] || []).length);
      } catch {
        // keep last known count
      }
    };

    void loadMusicCount();
    const interval = window.setInterval(loadMusicCount, 30000);
    const handleFocus = () => void loadMusicCount();
    window.addEventListener('focus', handleFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return (
    <main className="px-4 mb-10 py-5 max-w-9xl mx-auto text-primary">
      <Switchbutton searchHref="/search" />

      <FeaturedAudioCards />

      <p className="relative mt-2 rounded-2xl bg-cardcl/40 p-2.5 sm:p-4 sm:mt-6 text-center text-sm font-medium text-secondry shadow-xl shadow-black/20 backdrop-blur-xl md:text-left">
        <span className="absolute -top-3 left-4 rounded-full border border-navlink/30 bg-navlink/10 px-3 py-0.5 text-[10px] font-semibold tracking-wider text-navlink uppercase shadow-sm">
          🔥 Hot & Fresh
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-sm sm:text-base font-semibold text-primary tracking-tight">
            Trending Artists on Noll Music Uganda
          </span>
          <span className="text-[11px] sm:text-xs text-secondry/60 font-normal leading-snug hidden sm:block">
            Discover fresh sounds &amp; visual creations rising right now.
          </span>
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

      {/* Tab header */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: active title + count */}
          <span className="flex items-center gap-2 text-base font-bold text-primary">
            {activeTab === 'music'
              ? <Music2 size={16} className="shrink-0 text-navlink" />
              : <Mic2 size={16} className="shrink-0 text-navlink" />}
            {activeTab === 'music'
              ? <>All Music{musicCount !== null && <span className="text-secondry/60 font-medium"> ({musicCount})</span>}</>
              : <>All Artists{artistCount !== null && <span className="text-secondry/60 font-medium"> ({artistCount})</span>}</>}
          </span>

          {/* Right: single toggle button showing the inactive tab */}
          {activeTab === 'music' ? (
            <button
              onClick={() => setActiveTab('artist')}
              type="button"
              className="group flex items-center gap-2 rounded-full border border-navlink/25 bg-navlink/8 px-6 sm:px-40 py-2 text-xs font-semibold text-navlink shadow-sm shadow-navlink/10 transition-all duration-200 hover:border-navlink/50 hover:bg-navlink/15 hover:shadow-md hover:shadow-navlink/15 active:scale-95 cursor-pointer min-h-9"
              >
              <Mic2 size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:scale-110" />
              <span>Artists</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('music')}
              type="button"
              className="group flex items-center gap-2 rounded-full border border-navlink/25 bg-navlink/8 px-6 sm:px-40 py-2 text-xs font-semibold text-navlink shadow-sm shadow-navlink/10 transition-all duration-200 hover:border-navlink/50 hover:bg-navlink/15 hover:shadow-md hover:shadow-navlink/15 active:scale-95 cursor-pointer min-h-9"
              >
              <Music2 size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:scale-110" />
              <span>Music</span>
            </button>
          )}
        </div>

        {/* Artist-only search bar */}
        {activeTab === 'artist' && (
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-secondry/40 group-focus-within:text-navlink/80 pointer-events-none transition-colors duration-200"
              />
              <input
                type="search"
                value={artistSearchTerm}
                onChange={(e) => setArtistSearchTerm(e.target.value)}
                placeholder={isListening ? 'Listening…' : 'Search Artists…'}
                className="w-full rounded-full bg-cardcl/50 backdrop-blur-sm py-3 pl-11 pr-5 text-sm text-primary placeholder:text-secondry/35 shadow-sm transition-all duration-200 focus:bg-cardcl/80 focus:shadow-md focus:shadow-navlink/10 focus:ring-2 focus:ring-navlink/15 focus:outline-none"
              />
            </div>

            {/* Hold-to-talk mic button */}
            <button
              type="button"
              aria-label="Hold to search by voice"
              onPointerDown={(e) => { e.preventDefault(); startListening(); }}
              onPointerUp={stopListening}
              onPointerLeave={stopListening}
              className={[
                'shrink-0 flex items-center justify-center rounded-full w-11 h-11 transition-all duration-200 select-none touch-none',
                isListening
                  ? 'bg-navlink/15 text-navlink scale-110 shadow-md shadow-navlink/25 ring-2 ring-navlink/30'
                  : 'bg-cardcl/50 text-secondry/50 hover:bg-navlink/10 hover:text-navlink/80 active:scale-95',
              ].join(' ')}
            >
              {isListening ? (
                <span className="relative flex items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-navlink/40 opacity-75" />
                  <Mic size={20} strokeWidth={2} />
                </span>
              ) : (
                <Mic size={20} strokeWidth={2} />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 max-w-8xl mx-auto">
        <div id="music-list-container" className={`grid grid-cols-1 w-full rounded-xl bg-mrow/30 overflow-hidden ${activeTab === 'music' ? '' : 'hidden'}`}>
          <AudioTrackList searchTerm="" />
        </div>
        <div id="artist-list-container" className={`grid grid-cols-1 w-full rounded-xl bg-mrow/30 overflow-hidden ${activeTab === 'artist' ? '' : 'hidden'}`}>
          <ArtistList searchTerm={artistSearchTerm} />
        </div>
      </div>
    </main>
  );
}
