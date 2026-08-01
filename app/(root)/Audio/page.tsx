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
    <main className="px-4 py-8 max-w-9xl mx-auto text-primary">
          <Switchbutton onScrollToSearch={scrollToSearch} />

          <div className="mt-2 mb-5 text-center sm:text-start flex flex-col items-center sm:items-start">

            <div className="relative inline-block">
              <div className="absolute -inset-0.5 rounded-lg bg-amber-400/30 blur-sm" />
              <p className="relative w-fit rounded-[7px] border border-amber-400/40 bg-amber-400 px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold tracking-wide text-slate-950 text-center shadow-lg shadow-amber-400/20">
                Your Vision, Our Craft.
              </p>
            </div>

          <h1 className="text-3xl sm:text-5xl mt-2 font-bold text-primary">Noll Music</h1>

          <div className="relative mt-3 inline-block">
            <div className="absolute -inset-1 rounded-xl bg-amber-400/10 blur-sm" />
            <h3 className="relative rounded-xl border border-amber-400/20 bg-cardcl/60 px-4 py-2.5 text-[clamp(0.7rem,2.5vw,1rem)] text-amber-400 shadow-sm backdrop-blur-md">
              If you can dream it, Noll can design, shoot, and store it.
            </h3>
          </div>

          </div>

          <FeaturedAudioCards />

          <p className="relative mt-6 rounded-2xl border border-amber-400/20 bg-cardcl/40 p-4 text-center text-sm font-medium text-secondry shadow-lg shadow-black/5 backdrop-blur-xl md:text-left">
            <span className="absolute -top-3 left-4 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-0.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase shadow-sm">
              🔥 Hot & Fresh
            </span>
            Exploring the latest audio and visual creations emerging from Noll Studio Uganda.
          </p>

          <div className="search-box mt-1">
            <input
              ref={searchRef}
              type="text"
              id="trackSearchInput"
              placeholder="Search tracks or artists..."
              value={searchTerm}
              className="w-full rounded-4xl border border-card1/20 bg-cardcl/80 px-4 py-3 text-primary placeholder-secondry focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              onChange={(e) => filterTracks(e.target.value)}
            />
          </div>

          {/* Switch Buttons for All Music & All Artist */}
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
