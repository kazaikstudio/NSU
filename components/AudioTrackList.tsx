'use client';

import { useEffect, useRef, useState } from 'react';
import AudioRow from './AudioRow';
import { readCachedData, writeCachedData } from '@/lib/client-cache';
import { fetchAudioData, readCachedAudioData } from '@/lib/audio-data';
import { playerTrackFor } from '@/lib/audio-player';

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
  featuredArtistId?: string | null;
  artistGenre?: string | null;
  artistProfileUrl?: string | null;
  thumbnailUrl?: string | null;
  downloadCount?: number;
  playCount?: number;
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

async function fetchAudioTracks(): Promise<{ tracks: AudioTrack[]; fallback: boolean }> {
  const data = await fetchAudioData();
  const loadedTracks = Array.isArray(data.tracks) ? data.tracks : [];
  return {
    tracks: loadedTracks.map((track: AudioTrack & { featured_artist_name?: string | null }) => ({
      ...track,
      featuredArtistName: track.featuredArtistName ?? track.featured_artist_name ?? null,
    })),
    fallback: data.fallback ?? false,
  };
}

export default function AudioTrackList({ searchTerm }: { searchTerm: string }) {
  const [tracks, setTracks] = useState<AudioTrack[]>(
    cachedTracks ||
    (() => {
      const shared = readCachedAudioData();
      return shared && Array.isArray(shared.tracks)
        ? shared.tracks.map((track) => ({
            ...track,
            featuredArtistName: track.featuredArtistName ?? null,
          }))
        : [];
    })()
  );
  const [loading, setLoading] = useState(cachedTracks == null && !readCachedAudioData());
  const [error, setError] = useState('');
  const loadedOnceRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        const { tracks: loadedTracks, fallback } = await fetchAudioTracks();
        if (cancelled) return;
        loadedOnceRef.current = true;

        // When the API falls back to demo tracks, keep showing the last-known-
        // good list from the cache instead of the demo payload.
        const cached = readCachedData<AudioTrack[]>(CACHE_KEY);
        const nextTracks =
          fallback && cached && cached.length > 0 ? cached : loadedTracks;

        // Only persist genuine track data so a temporary outage never saves
        // demo tracks over the good cache.
        if (!fallback && nextTracks.length > 0) {
          writeCachedData(CACHE_KEY, nextTracks);
        }

        setError('');
        setTracks((prev: AudioTrack[]) => {
          const hasChanges = JSON.stringify(prev) !== JSON.stringify(nextTracks);
          return hasChanges ? nextTracks : prev;
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
    const handleFocus = () => void loadTracks();
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTracks = tracks
    .filter((track) =>
      [track.title, track.artistName, track.featuredArtistName || '', track.album || ''].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    )
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }));

  const playerQueue = filteredTracks
    .filter((track) => track.fileUrl)
    .map((track) => playerTrackFor(
      track.id,
      track.title,
      getPlayableAudioUrl(track.fileUrl),
      {
        artist: track.featuredArtistName
          ? `${track.artistName} ft ${track.featuredArtistName}`
          : track.artistName,
        thumbnailUrl: normalizeImageUrl(track.thumbnailUrl),
        fileUrl: track.fileUrl,
        fileName: track.fileName,
      },
    ));

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
            playCount={track.playCount}
            thumbnailUrl={normalizeImageUrl(track.thumbnailUrl)}
            isShared={Boolean(track.featuredArtistId)}
            playerQueue={playerQueue}
            playerQueueIndex={playerQueue.findIndex((q) => q.id === track.id)}
          />
        );
      })}
    </div>
  );
}
