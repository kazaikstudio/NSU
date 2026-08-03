'use client';

import React from 'react';

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  downloads?: number;
}

interface TrendingCardProps {
  artist?: Artist;
  isTop?: boolean;
}

const TrendingCard: React.FC<TrendingCardProps> = ({ artist, isTop }) => {
  if (!artist) {
    return null;
  }

  function normalizeImageUrl(url?: string) {
    if (!url) return undefined;
    try {
      const driveFileMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
      const fileId = driveFileMatch ? (driveFileMatch[1] || driveFileMatch[2]) : null;
      if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
      return url;
    } catch {
      return url;
    }
  }

  return (
    <div className="relative flex flex-col items-center gap-1.5 w-24 sm:w-28 shrink-0 text-center">
      {isTop && (
        <div className="absolute -top-1 left-1 z-10 bg-amber-400 text-black text-[10px] px-2 py-0.5 rounded-full font-semibold shadow">
          Top Artist
        </div>
      )}

      {/* Circular Avatar */}
      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border border-white/10 shadow-lg hover:scale-105 transition-transform duration-300 bg-zinc-800 shrink-0">
        {artist.avatarUrl ? (
          <img
            src={normalizeImageUrl(artist.avatarUrl)}
            alt={artist.name || 'Artist'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xl sm:text-2xl font-semibold">
            {artist.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Artist Name */}
      <span className="text-primary font-medium text-xs sm:text-base truncate w-full px-1">
        {artist.name || 'Unknown Artist'}
      </span>

      {/* Downloads count */}
      {typeof artist.downloads === 'number' && (
        <p
          className="text-secondary text-[11px] sm:text-xs w-full truncate">
          {artist.downloads.toLocaleString()} downloads
        </p>
      )}
    </div>
  );
};

export default TrendingCard;
