'use client';

import { useEffect, useState } from 'react';
import AudioCard, { FeaturedAudioTrack } from './AudioCard';

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

export default function FeaturedAudioCards() {
  const [tracks, setTracks] = useState<FeaturedAudioTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadFeaturedTracks = async () => {
      try {
        const response = await fetch('/api/audio');
        const data = await response.json();
        if (!cancelled) {
          setTracks((data.tracks || []).slice(0, 5).map((track: FeaturedAudioTrack) => ({
            ...track,
            fileUrl: getPlayableAudioUrl(track.fileUrl),
          })));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFeaturedTracks();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Loading featured audio...</p>;
  if (tracks.length === 0) return <p className="py-12 text-center text-sm text-slate-400">No uploaded audio available yet.</p>;

  return (
    <>
      <div
        className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-none pb-4"
        onScroll={(event) => {
          const cardWidth = event.currentTarget.firstElementChild?.clientWidth || event.currentTarget.clientWidth;
          setCurrentIndex(Math.round(event.currentTarget.scrollLeft / cardWidth));
        }}
      >
        <div className="flex gap-4">
          {tracks.map((track) => (
            <div key={track.id} className="w-full shrink-0 snap-start sm:w-[calc(50%-8px)] lg:w-[calc(20%-13px)]">
              <AudioCard
                track={track}
                isPlaying={activeTrackId === track.id}
                onToggle={() => setActiveTrackId((currentId) => currentId === track.id ? null : track.id)}
                onEnded={() => setActiveTrackId(null)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2 mt-2 flex items-center justify-center gap-2 sm:hidden">
        {tracks.map((track, index) => (
          <span key={track.id} className={`h-2 rounded-full transition-all duration-300 ${currentIndex === index ? 'w-6 bg-amber-500' : 'w-2 bg-zinc-700'}`} />
        ))}
      </div>
    </>
  );
}