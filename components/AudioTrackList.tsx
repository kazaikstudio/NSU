'use client';

import { useEffect, useState } from 'react';
import AudioPlayer from './AudioPlayer';

interface AudioTrack {
  id: string;
  title: string;
  album?: string | null;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  artistId: string;
  artistName: string;
  artistGenre?: string | null;
  artistProfileUrl?: string | null;
}

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

export default function AudioTrackList({ searchTerm }: { searchTerm: string }) {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        const response = await fetch('/api/audio');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load music');
        if (!cancelled) setTracks(data.tracks || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load music');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTracks();
    return () => { cancelled = true; };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTracks = tracks.filter((track) =>
    [track.title, track.artistName, track.album || ''].some((value) =>
      value.toLowerCase().includes(normalizedSearch)
    )
  );

  if (loading) return <p className="col-span-full py-16 text-center text-sm text-slate-400">Loading uploaded music...</p>;
  if (error) return <p className="col-span-full py-16 text-center text-sm text-red-400">{error}</p>;
  if (filteredTracks.length === 0) {
    return <p className="col-span-full py-16 text-center text-sm text-slate-400">No uploaded music matches your search.</p>;
  }

  return (
    <div className="col-span-full flex flex-col gap-1">
      {filteredTracks.map((track) => (
        <AudioPlayer
          key={track.id}
          src={getPlayableAudioUrl(track.fileUrl)}
          fileUrl={track.fileUrl}
          title={track.title}
          album={track.album}
          fileName={track.fileName}
          createdAt={track.createdAt}
          artistName={track.artistName}
          artistGenre={track.artistGenre}
        />
      ))}
    </div>
  );
}
