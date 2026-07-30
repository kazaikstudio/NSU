"use client";

import React, { useState } from 'react';
import Switchbutton from '../../../components/Switchbutton';
import AudioCard from '../../../components/AudioCard';

const Music = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cards = [0, 1, 2, 3, 4];
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'music' | 'artist'>('music');

  const filterTracks = (query: string) => {
    setSearchTerm(query);
  };

  return (
    <main className="px-4 py-8 max-w-9xl mx-auto">
      <Switchbutton />

      <div className="mt-5 text-center sm:text-start flex flex-col items-center sm:items-start">
        <p className="w-fit rounded-[5px] px-4 sm:px-6 py-2.5 sm:py-3 bg-amber-300 text-black text-xs sm:text-sm font-medium text-center">Your Vision, Our Craft.</p>
        <h1 className="text-3xl sm:text-5xl mt-2 font-bold text-amber-50">NOLL VISUALS</h1>
        <h3 className="text-sm sm:text-lg text-yellow-500 mt-1 italic">&ldquo;If you can dream it, Noll can design, shoot, and store it.&rdquo;</h3>
      </div>

      <div
        className="overflow-x-auto snap-x snap-mandatory scrollbar-none w-full pb-4 cursor-grab active:cursor-grabbing select-none"
        onScroll={(e) => {
          const scrollLeft = e.currentTarget.scrollLeft;
          const cardWidth = e.currentTarget.firstElementChild?.firstElementChild?.clientWidth || e.currentTarget.clientWidth;
          const newIndex = Math.round(scrollLeft / cardWidth);
          setCurrentIndex(newIndex);
        }}
      >
        <div className="slider-track flex gap-4 w-full">
          {cards.map((_, index) => (
            <div key={index} className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(20%-13px)] shrink-0 snap-start">
              <AudioCard />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Swipe Dots Indicator */}
      <div className="flex justify-center items-center gap-2 mt-2 mb-2 sm:hidden">
        {cards.map((_, index) => (
          <span
            key={index}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentIndex === index ? 'w-6 bg-amber-500' : 'w-2 bg-zinc-700'
            }`}
          />
        ))}
      </div>

      <p className="text-zinc-300 text-sm">🔥 Exploring the Hot, fresh Audio and Visual creations emerging from Noll Studio Uganda.</p>

      <div className="search-box mt-4">
        <input
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
            {/* Music items will be rendered here */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 text-sm flex items-center justify-center min-h-140px w-full col-span-full">
              New Music Creations Container (Wide Screen)
            </div>
          </div>
        ) : (
          <div id="artist-list-container" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full">
            {/* Artist items will be rendered here */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-400 text-sm flex items-center justify-center min-h-140px w-full col-span-full">
              New Artist Creations Container (Wide Screen)
            </div>
          </div>
        )}
      </div>

    </main>
  );
};

export default Music;
