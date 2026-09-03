'use client';

import Link from 'next/link';
import { ArrowLeft, Bell, BellOff, Radio, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AudioPlayer from '@/components/AudioPlayer';
import ArtistProfileLoading from '@/components/ArtistProfileLoading';
import { getArtistById } from '@/lib/artists';
import { getClientCachedData, hasClientCachedData } from '@/lib/client-cache';

interface Artist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: string;
  bio: string;
  followers: number;
  monthlyListeners: number;
  totalDownloads: number;
  bannerUrl?: string | null;
  profileUrl?: string | null;
}

interface Track {
  id: string;
  title: string;
  album?: string | null;
  fileName: string;
  fileUrl?: string;
  downloadCount?: number;
  createdAt?: string;
}

function getPlayableAudioUrl(url: string) {
  const match = url.match(/[?&]id=([^&]+)/);
  return match?.[1] ? `/api/dashboard/media/${match[1]}` : url;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function getSubscriberId() {
  const storageKey = 'nsu-subscriber-id';
  const existingId = window.localStorage.getItem(storageKey);
  if (existingId) return existingId;

  const subscriberId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `subscriber-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, subscriberId);
  return subscriberId;
}

function getDriveFileId(fileUrl: string) {
  return fileUrl.match(/[?&]id=([^&]+)/)?.[1] || null;
}

export default function PublicArtistDetailPage() {
  const params = useParams<{ id: string }>();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(() => !hasClientCachedData(`artist:${params.id}`));
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [activeTrackDownloads, setActiveTrackDownloads] = useState(0);
  const latestTrackId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadArtist = async () => {
      try {
        const [artistData, mediaData, followState] = await Promise.all([
          getClientCachedData(`artist:${params.id}`, async () => {
            const response = await fetch(`/api/dashboard/artists/${params.id}`);
            if (!response.ok) throw new Error('Artist not found');
            return response.json();
          }),
          getClientCachedData(`artist-media:${params.id}`, async () => {
            const response = await fetch(`/api/dashboard/artists/${params.id}/media`);
            if (!response.ok) return { media: [] };
            return response.json();
          }),
          (async () => {
            try {
              const followResponse = await fetch(`/api/artists/${params.id}/follow`, {
                headers: { 'x-subscriber-id': getSubscriberId() },
              });
              return followResponse.ok ? await followResponse.json() : null;
            } catch {
              return null;
            }
          })(),
        ]);
        if (!artistData.artist) throw new Error('Artist not found');

        if (!cancelled) {
          setArtist(artistData.artist);
          if (followState) {
            setIsFollowing(followState.following === true);
            setArtist((currentArtist) => currentArtist
              ? { ...currentArtist, followers: Number(followState.followerCount || 0) }
              : currentArtist);
          }
          const loadedTracks = (mediaData.media || []).filter((media: Track & { kind?: string }) => media.kind === 'track');
          latestTrackId.current = loadedTracks[0]?.id || null;
          setTracks(loadedTracks);
          setLoading(false);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load artist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (params.id) void loadArtist();
    return () => { cancelled = true; };
  }, [params.id]);

  useEffect(() => {
    if (!artist?.id || !isFollowing) return;

    const checkForNewUploads = async () => {
      try {
        const response = await fetch(`/api/dashboard/artists/${artist.id}/media`, { cache: 'no-store' });
        if (!response.ok) return;
        const mediaData = await response.json();
        const currentTracks = (mediaData.media || []).filter((media: Track & { kind?: string }) => media.kind === 'track');
        const newestTrack = currentTracks[0];

        if (newestTrack && latestTrackId.current && newestTrack.id !== latestTrackId.current) {
          setTracks(currentTracks);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`New upload from ${artist.name}`, { body: newestTrack.title });
          }
        }
        if (newestTrack) latestTrackId.current = newestTrack.id;
      } catch {
        // Polling is best effort and should not interrupt playback.
      }
    };

    const intervalId = window.setInterval(() => void checkForNewUploads(), 60_000);
    return () => window.clearInterval(intervalId);
  }, [artist, isFollowing]);

  const toggleFollow = async () => {
    if (!artist || followLoading) return;
    setFollowLoading(true);

    try {
      const nextFollowing = !isFollowing;
      const response = await fetch(`/api/artists/${artist.id}/follow`, {
        method: nextFollowing ? 'POST' : 'DELETE',
        headers: { 'x-subscriber-id': getSubscriberId() },
      });
      if (!response.ok) throw new Error('Unable to update follow status');
      const result = await response.json();
      setIsFollowing(result.following === true);
      setArtist((currentArtist) => currentArtist
        ? { ...currentArtist, followers: Number(result.followerCount || 0) }
        : currentArtist);

      if (nextFollowing && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (followError) {
      setError(followError instanceof Error ? followError.message : 'Unable to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const syncPlayCount = async (trackId: string, fileUrl: string) => {
    const driveFileId = getDriveFileId(fileUrl);
    if (!driveFileId) return;

    const nextDownloadCount = (tracks.find((track) => track.id === trackId)?.downloadCount ?? 0) + 1;
    setActiveTrackId(trackId);
    setActiveTrackDownloads(nextDownloadCount);
    setTracks((currentTracks) => currentTracks.map((track) => track.id === trackId
      ? { ...track, downloadCount: Number(track.downloadCount || 0) + 1 }
      : track));

    try {
      const response = await fetch(`/api/dashboard/media/${driveFileId}?play=1`, { method: 'GET', cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      const updatedCount = Number(result.trackDownloads || nextDownloadCount || 0);
      setActiveTrackDownloads(updatedCount);
      setTracks((currentTracks) => currentTracks.map((track) => track.id === trackId
        ? { ...track, downloadCount: updatedCount }
        : track));
    } catch {
      // Playback continues even if the DB result is delayed; the UI already updated optimistically.
    }
  };

  if (loading) {
    const loadingName = artist?.name || getArtistById(params.id)?.name || 'artist';
    return (
      <ArtistProfileLoading
        artistName={loadingName}
        description={`Loading ${loadingName} details and media from the dashboard.`}
      />
    );
  }

  if (error || !artist) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-cardcl px-4 text-center text-primary">
        <p className="text-sm text-secondry">{error || 'Artist not found'}</p>
        <Link href="/Audio" className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-cardcl transition hover:bg-amber-300 shadow-lg shadow-amber-400/20 cursor-pointer">
          <ArrowLeft size={16} /> Back to Audio
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-24 text-primary selection:bg-amber-400 selection:text-cardcl">
    {/* Hero Header Section */}
    <section className="relative m-2 sm:m-4 overflow-hidden rounded-3xl border border-card1/10 bg-cardcl/60 shadow-xl backdrop-blur-2xl transition-all">
      {/* Top Cover / Banner Image */}
      <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-linear-to-r from-amber-400/20 via-amber-300/10 to-cardcl/80">
        {/* Banner Image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: artist.bannerUrl ? `url(${artist.bannerUrl})` : undefined }}
        />

        {/* Glassmorphic Backdrop Blur Overlay (Mobile Only) */}
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-cardcl/60 backdrop-blur-sm sm:backdrop-blur-none" />

        {/* Back Navigation Button */}
        <div className="relative z-10 p-4 sm:p-6">
          <Link
            href="/Audio"
            className="inline-flex items-center gap-2 rounded-full border border-card1/10 bg-cardcl/80 px-4 py-1.5 text-xs font-semibold text-secondry shadow-sm transition hover:border-amber-400/40 hover:text-amber-400 cursor-pointer backdrop-blur-md"
          >
            <ArrowLeft size={14} /> Back to Audio
          </Link>
        </div>
      </div>

      {/* Bottom Profile Details Container */}
      <div className="relative z-10 px-4 xs:px-5 sm:px-10 pb-6 sm:pb-8">
        {/* Avatar & Action Buttons Row */}
        <div className="flex items-start justify-between gap-2 sm:items-end sm:gap-4 -mt-28 xs:-mt-24 sm:-mt-20 mb-4 sm:mb-6">
          {/* Overlapping Circular Avatar (Pushed high up toward back button on mobile) */}
          <div
            className="relative flex h-32 w-32 xs:h-28 xs:w-28 sm:h-36 sm:w-36 shrink-0 items-center justify-center overflow-hidden rounded-full border-3 sm:border-4 border-cardcl bg-cardcl text-2xl xs:text-3xl sm:text-5xl font-black text-amber-400 shadow-xl"
            style={
              artist.profileUrl
                ? { backgroundImage: `url(${artist.profileUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
            role={artist.profileUrl ? 'img' : undefined}
            aria-label={artist.profileUrl ? `${artist.name} profile` : undefined}
          >
            {!artist.profileUrl && artist.name.charAt(0).toUpperCase()}
          </div>

          {/* Action Buttons (Right aligned at the top) */}
          <div className="flex items-center gap-1.5 xs:gap-2 justify-end pt-17 xs:pt-8 sm:pt-0">
            <button
              type="button"
              onClick={() => void toggleFollow()}
              disabled={followLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-cardcl px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold shadow-md transition hover:opacity-90 active:scale-95 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              {isFollowing ? <BellOff size={14} className="sm:w-4 sm:h-4" /> : <Bell size={14} className="sm:w-4 sm:h-4" />}
              <span>{followLoading ? '...' : isFollowing ? 'Following' : '+ Follow'}</span>
            </button>

            <div className="inline-flex items-center gap-1 rounded-xl border border-card1/10 bg-cardcl/80 px-2.5 py-2 sm:px-3 sm:py-2.5 text-[11px] sm:text-xs font-semibold text-secondry shadow-sm backdrop-blur-md">
              <Sparkles size={13} className="text-amber-400 shrink-0 sm:w-3.5 sm:h-3.5" />
              <span className="capitalize">{artist.status || 'Verified'}</span>
            </div>
          </div>
        </div>

        {/* Artist Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <h1
              className="font-black tracking-tight text-primary leading-tight min-w-0 wrap-break-word"
              style={{ fontSize: 'clamp(1.25rem, 5vw, 2.25rem)' }}
            >
              {artist.name}
            </h1>
            <Sparkles size={16} className="text-amber-400 fill-amber-400 shrink-0 sm:w-5 sm:h-5" />
          </div>

          {artist.genre && (
            <p className="pt-0.5 text-xs sm:text-sm font-semibold text-amber-400 flex items-center gap-1.5">
              <Radio size={13} className="sm:w-3.5 sm:h-3.5" />
              {artist.genre}
            </p>
          )}
        </div>

        {/* About / Bio Section */}
        <div className="mt-4 sm:mt-6 space-y-1 max-w-2xl">
          <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary">About</h3>
          <p className="text-xs sm:text-sm leading-relaxed text-secondry/90 line-clamp-3 xs:line-clamp-none">
            {artist.bio ||
              `Exploring the latest audio and visual creations emerging from ${artist.name}. Blending rhythm, performance, and creative craft.`}
          </p>
        </div>

        {/* Stats Row */}
        <div className="mt-5 mx-auto text-center sm:text-left sm:mx-0 sm:mt-8 grid grid-cols-3 gap-2 border-t border-card1/10 pt-4 sm:pt-6 max-w-lg">
          <div className="min-w-0">
            <span className="block text-base xs:text-lg sm:text-2xl font-black text-primary truncate">
              {artist.tracksCount || tracks.length}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-secondry block truncate">Tracks</span>
          </div>
          <div className="min-w-0">
            <span className="block text-base xs:text-lg sm:text-2xl font-black text-primary truncate">
              {formatNumber(artist.followers)}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-secondry block truncate">Following</span>
          </div>
          <div className="min-w-0">
            <span className="block text-base xs:text-lg sm:text-2xl font-black text-primary truncate">
              {activeTrackId ? formatNumber(activeTrackDownloads) : formatNumber(artist.totalDownloads)}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-secondry block truncate">Downloads</span>
          </div>
        </div>
      </div>

    </section>

      {/* Main Single-Column Full-Width Content Layout */}
      <div className="relative mx-auto max-w-8xl px-4 py-4 sm:px-6 space-y-3 ">

        {/* Released Tracks Section */}
        <div>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-primary tracking-tight">Released Tracks</h2>
              <p className="mt-1 text-xs text-secondry">Listen to music uploaded by Noll Studio.</p>
            </div>
            <span className="rounded-full bg-cardcl border border-card1/20 px-3 py-1 text-xs font-semibold text-secondry">
              {tracks.length} available
            </span>
          </div>

          {tracks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-card1/20 bg-cardcl/20 px-6 py-16 text-center text-sm text-secondry">
              No uploaded tracks available yet.
            </div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track) => {
                if (!track.fileUrl) {
                  return (
                    <div key={track.id} className="rounded-2xl border border-card1/20 bg-cardcl/60 px-4 py-3 text-xs text-secondry">
                      {track.title}: Audio unavailable
                    </div>
                  );
                }

                return (
                  <AudioPlayer
                    key={track.id}
                    src={getPlayableAudioUrl(track.fileUrl)}
                    fileUrl={track.fileUrl}
                    title={track.title}
                    album={track.album}
                    fileName={track.fileName}
                    createdAt={track.createdAt}
                    artistName={artist.name}
                    artistGenre={artist.genre}
                    onPlay={() => void syncPlayCount(track.id, track.fileUrl || '')}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
