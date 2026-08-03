"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, Mic, MicOff } from 'lucide-react';
import Switchbutton from './Switchbutton';

// --- Web Speech API Interfaces to eliminate 'any' errors ---
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEventCustom extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventCustom extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventCustom) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventCustom) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface VoiceSearchBarProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterTracks: (value: string) => void;
}

export function VoiceSearchBar({
  searchTerm,
  setSearchTerm,
  filterTracks,
}: VoiceSearchBarProps) {
  const [isListening, setIsListening] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    // Initialize Web Speech API cleanly without type casting to 'any'
    const win = window as unknown as WindowWithSpeech;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEventCustom) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        // Update input state and filter function live as you speak
        setSearchTerm(transcript);
        filterTracks(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventCustom) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [filterTracks, setSearchTerm]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      searchRef.current?.focus();
    }
  };

  return (
    <div className="flex items-center gap-3 w-full max-w-xl my-4">
      {/* Search Input Box */}
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary/70 pointer-events-none transition-colors" />
        <input
          ref={searchRef}
          type="text"
          id="trackSearchInput"
          placeholder="Search here ..."
          value={searchTerm}
          className="w-full rounded-full border border-card1/15 bg-cardcl/60 dark:bg-cardcl/40 backdrop-blur-md pl-11 pr-4 py-3 text-primary placeholder:text-secondary/60 focus:border-navlink focus:ring-1 focus:ring-navlink focus:bg-cardcl/80 transition-all duration-300 text-sm shadow-sm hover:border-card1/25"
          onChange={(e) => {
            setSearchTerm(e.target.value);
            filterTracks(e.target.value);
          }}
        />
      </div>

      {/* Circular Microphone Button */}
      <button
        type="button"
        onClick={toggleListening}
        className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 transition-all duration-300 shadow-md backdrop-blur-md ${
          isListening
            ? 'bg-red-500/90 text-white animate-pulse shadow-red-500/40 ring-4 ring-red-500/20'
            : 'bg-cardcl/60 dark:bg-cardcl/40 text-primary border border-card1/15 hover:bg-cardcl/90 hover:border-card1/30 hover:scale-105 active:scale-95'
        }`}
        title={isListening ? 'Stop recording' : 'Start voice search'}
      >
        {isListening ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}

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

export default function AudioPageClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'music' | 'artist'>('music');
  const [dashboardArtists, setDashboardArtists] = useState<Array<any>>([]);
  const [topArtists, setTopArtists] = useState<Array<any>>([]);

  const filterTracks = (query: string) => {
    setSearchTerm(query);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/artists');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load dashboard artists');
        const mapped = (data.artists || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          avatarUrl: a.profileUrl || a.profileUrl || null,
          downloads: Number(a.totalDownloads || 0),
        }));
        if (!cancelled) setDashboardArtists(mapped);
        if (mapped.length > 0) {
          const ranked = [...mapped].sort((a: any, b: any) => (b.downloads || 0) - (a.downloads || 0));
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

  const scrollToSearch = () => {
    const searchInput = document.getElementById('trackSearchInput');
    if (searchInput) {
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchInput.focus();
    }
  };

  return (
    <main className="px-4 mb-10 py-5 max-w-9xl mx-auto text-primary">
      <Switchbutton onScrollToSearch={scrollToSearch} />

      <VoiceSearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterTracks={filterTracks}
      />

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
