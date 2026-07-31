"use client";

import React, { useRef, useState } from 'react';
import Switchbutton from '../../../components/Switchbutton';
import FeaturedAudioCards from '../../../components/FeaturedAudioCards';
import AudioTrackList from '../../../components/AudioTrackList';
import ArtistList from '../../../components/ArtistList';

const Music = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'music' | 'artist'>('music');
  const searchRef = useRef<HTMLInputElement>(null);

  const filterTracks = (query: string) => {
    setSearchTerm(query);
  };

  const scrollToSearch = () => {
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchRef.current?.focus();
  };

  return (
    <main className="px-4 py-8 max-w-9xl mx-auto">
      <Switchbutton onScrollToSearch={scrollToSearch} />

      <div className="mt-2 mb-5 text-center sm:text-start flex flex-col items-center sm:items-start">
        <p className="w-fit rounded-[5px] px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-300 text-black text-xs sm:text-sm font-medium text-center">Your Vision, Our Craft.</p>
        <h1 className="text-5xl sm:text-5xl mt-2 font-bold text-amber-50">Noll Music</h1>
        <h3 className="text-sm sm:text-lg text-yellow-500 mt-1 italic">&ldquo;If you can dream it, Noll can design, shoot, and store it.&rdquo;</h3>
      </div>

      <FeaturedAudioCards />

      <p className="mt-5 text-center text-sm text-zinc-300 md:text-left">
        🔥 Exploring the Hot, fresh Audio and Visual creations emerging from Noll Studio Uganda.
      </p>

      <div className="search-box mt-4">
        <input
          ref={searchRef}
          type="text"
          id="trackSearchInput"
          placeholder="Search tracks or artists..."
          value={searchTerm}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          onChange={(e) => filterTracks(e.target.value)}
        />
      </div>

      {/* Switch Buttons for All Music & All Artist */}
      <div className="flex items-center w-full mt-5 bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-800">
        <button
          onClick={() => setActiveTab('music')}
          type="button"
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'music'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          All Music
        </button>
        <button
          onClick={() => setActiveTab('artist')}
          type="button"
          className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'artist'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          All Artist
        </button>
      </div>

      {/* List Container Section */}
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
};

export default Music;
