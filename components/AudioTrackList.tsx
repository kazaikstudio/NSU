'use client';

import { useEffect, useRef, useState } from 'react';
import AudioRow from './AudioRow';
import { readCachedData, writeCachedData } from '@/lib/client-cache';

const CACHE_KEY = 'audio:tracks';
const cachedTracks = readCachedData<AudioTrack[]>(CACHE_KEY);

interface AudioTrack {
  id: string;
  title: string;
  album?: string | null;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  artistId: string;
  artistName: string;
  featuredArtistName?: string | null;
  artistGenre?: string | null;
  artistProfileUrl?: string | null;
  thumbnailUrl?: string | null;
  downloadCount?: number;
}

function normalizeImageUrl(url?: string | null) {
  if (!url) return undefined;
  try {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)/);
    const fid = m ? (m[1] || m[2]) : null;
    return fid ? `https://drive.google.com/thumbnail?id=${fid}&sz=w400` : url;
  } catch {
    return url;
  }
}

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

async function fetchAudioTracks(): Promise<AudioTrack[]> {
  const response = await fetch('/api/audio', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load music');
  const loadedTracks = Array.isArray(data.tracks) ? data.tracks : [];
  return loadedTracks.map((track: AudioTrack & { featured_artist_name?: string | null }) => ({
    ...track,
    featuredArtistName: track.featuredArtistName ?? track.featured_artist_name ?? null,
  }));
}

export default function AudioTrackList({ searchTerm }: { searchTerm: string }) {
  const [tracks, setTracks] = useState<AudioTrack[]>(cachedTracks || []);
  const [loading, setLoading] = useState(cachedTracks == null);
  const [error, setError] = useState('');
  const loadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        const loadedTracks = await fetchAudioTracks();
        if (cancelled) return;
        loadedOnceRef.current = true;
        writeCachedData(CACHE_KEY, loadedTracks);
        setError('');
        setTracks((prev: AudioTrack[]) => {
          const currentIds = new Set(prev.map((track) => track.id));
          const hasChanges =
            prev.length !== loadedTracks.length ||
            loadedTracks.some((track) => !currentIds.has(track.id));
          return hasChanges ? loadedTracks : prev;
        });
      } catch (loadError) {
        if (!cancelled && !loadedOnceRef.current) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load music');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTracks();
    const interval = window.setInterval(loadTracks, 30000);
    const handleFocus = () => void loadTracks();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTracks = tracks.filter((track) =>
    [track.title, track.artistName, track.featuredArtistName || '', track.album || ''].some((value) =>
      value.toLowerCase().includes(normalizedSearch)
    )
  );

  if (loading) return <p className="col-span-full py-16 text-center text-sm text-slate-400">Loading uploaded music...</p>;
  if (error) return <p className="col-span-full py-16 text-center text-sm text-red-400">{error}</p>;
  if (filteredTracks.length === 0) {
    return <p className="col-span-full py-16 text-center text-sm text-slate-400">No uploaded music matches your search.</p>;
  }

  return (
    <div className="col-span-full flex flex-col divide-y divide-card1/10">
      {filteredTracks.map((track) => {
        return (
          <AudioRow
            key={track.id}
            src={getPlayableAudioUrl(track.fileUrl)}
            fileUrl={track.fileUrl}
            title={track.title}
            album={track.album}
            fileName={track.fileName}
            createdAt={track.createdAt}
            artistName={track.artistName}
            featuredArtistName={track.featuredArtistName}
            artistGenre={track.artistGenre}
            downloadCount={track.downloadCount}
            thumbnailUrl={normalizeImageUrl(track.thumbnailUrl)}
          />
        );
      })}
    </div>
  );
}
