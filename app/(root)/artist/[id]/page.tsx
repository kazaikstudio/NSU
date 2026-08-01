'use client';

import Link from 'next/link';
import { ArrowLeft, Bell, BellOff, Users, Disc, Radio, Sparkles, Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AudioPlayer from '@/components/AudioPlayer';

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
  const [loading, setLoading] = useState(true);
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
        const artistResponse = await fetch(`/api/dashboard/artists/${params.id}`);
        const artistData = await artistResponse.json();
        if (!artistResponse.ok || !artistData.artist) throw new Error('Artist not found');

        const mediaResponse = await fetch(`/api/dashboard/artists/${params.id}/media`);
        const mediaData = mediaResponse.ok ? await mediaResponse.json() : { media: [] };

        if (!cancelled) {
          setArtist(artistData.artist);
          const loadedTracks = (mediaData.media || []).filter((media: Track & { kind?: string }) => media.kind === 'track');
          latestTrackId.current = loadedTracks[0]?.id || null;
          setTracks(loadedTracks);

          try {
            const followResponse = await fetch(`/api/artists/${params.id}/follow`, {
              headers: { 'x-subscriber-id': getSubscriberId() },
            });
            if (followResponse.ok) {
              const followState = await followResponse.json();
              setIsFollowing(followState.following === true);
              setArtist((currentArtist) => currentArtist
                ? { ...currentArtist, followers: Number(followState.followerCount || 0) }
                : currentArtist);
            }
          } catch {
            // Following is optional; keep the artist page usable if the database is unavailable.
          }
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

  const refreshTrackDownloads = async (trackId: string, fileUrl: string) => {
    const driveFileId = getDriveFileId(fileUrl);
    if (!driveFileId) return;

    try {
      const response = await fetch(`/api/dashboard/media/${driveFileId}/play`, { cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      setActiveTrackId(trackId);
      setActiveTrackDownloads(Number(result.trackDownloads || 0));
      setTracks((currentTracks) => currentTracks.map((track) => track.id === trackId
        ? { ...track, downloadCount: Number(result.trackDownloads || 0) }
        : track));
    } catch {
      // Playback should continue even when download statistics are unavailable.
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cardcl text-sm text-secondry">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <span>Loading artist profile...</span>
        </div>
      </main>
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
      <section className="relative m-2 sm:m-4 overflow-hidden rounded-3xl border border-amber-400/20 bg-cardcl/40 shadow-2xl backdrop-blur-2xl">
              {/* Banner Image placed completely behind with z-0 */}
              <div
                className="absolute inset-0 z-0 bg-cover bg-center opacity-40 scale-105"
                style={{ backgroundImage: artist.bannerUrl ? `url(${artist.bannerUrl})` : undefined }}
              />
              <div className="absolute inset-0 z-0 bg-linear-to-r from-cardcl/95 via-cardcl/80 to-cardcl/60" />

              {/* Content Container */}
              <div className="relative z-10 mx-auto max-w-8xl px-6 py-10 sm:px-10 sm:py-16">
                <Link href="/Audio" className="inline-flex items-center gap-2 rounded-full border border-card1/10 bg-cardcl/60 px-4 py-1.5 text-xs font-semibold text-secondry shadow-sm transition hover:border-amber-400/40 hover:text-amber-400 mb-8 cursor-pointer backdrop-blur-md">
                  <ArrowLeft size={14} /> Back to Audio
                </Link>

                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
                  {/* Profile Picture increased to take up roughly 98% width on mobile / expanded size */}
                  <div
                    className="relative flex w-[98%] max-w-sm aspect-square shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-amber-400/10 text-5xl font-black text-amber-300 shadow-xl shadow-amber-400/15 sm:h-56 sm:w-56 sm:max-w-none sm:aspect-auto"
                    style={artist.profileUrl ? { backgroundImage: `url(${artist.profileUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    role={artist.profileUrl ? 'img' : undefined}
                    aria-label={artist.profileUrl ? `${artist.name} profile` : undefined}
                  >
                    <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                    {!artist.profileUrl && artist.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Other elements pushed down / aligned */}
                  <div className="flex flex-col items-center text-center sm:items-start sm:text-left mt-2 sm:mt-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300 shadow-sm backdrop-blur-md mb-3">
                      <Sparkles size={12} />
                      <span>{artist.status} artist</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-primary sm:text-5xl lg:text-6xl bg-linear-to-r from-primary via-primary/90 to-amber-300 bg-clip-text">
                      {artist.name}
                    </h1>
                    <p className="mt-2 text-sm sm:text-base font-medium text-amber-400/90 flex items-center gap-2">
                      <Radio size={15} />
                      {artist.genre}
                    </p>
                    <button
                      type="button"
                      onClick={() => void toggleFollow()}
                      disabled={followLoading}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-amber-400/25 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isFollowing ? <BellOff size={16} /> : <Bell size={16} />}
                      {followLoading ? 'Saving...' : isFollowing ? 'Following' : 'Follow & notify'}
                    </button>
                  </div>
                </div>
              </div>
      </section>

      {/* Main Single-Column Full-Width Content Layout */}
      <div className="relative mx-auto max-w-8xl px-4 py-4 sm:px-6 space-y-3 ">

        {/* Quick Metrics Bar - 3 Columns on both Mobile and Desktop */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="rounded-lg border border-card1/20 bg-mrow/60 p-3.5 sm:p-5 backdrop-blur-md transition hover:border-amber-400/30">
            <p className="text-lg sm:text-2xl font-black text-Eltext1">{artist.tracksCount || tracks.length}</p>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-Eltext1 flex items-center gap-1.5 truncate">
              <Disc size={13} className="shrink-0 text-amber-400" /> <span className="truncate">Total Tracks</span>
            </p>
          </div>
          <div className="rounded-lg border border-card1/20 bg-mrow/60 p-3.5 sm:p-5 backdrop-blur-md transition hover:border-amber-400/30">
            <p className="text-lg sm:text-2xl font-black text-Eltext1">{formatNumber(artist.followers)}</p>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-Eltext1 flex items-center gap-1.5 truncate">
              <Users size={13} className="shrink-0 text-amber-400" /> <span className="truncate">Followers</span>
            </p>
          </div>
          <div className="rounded-lg border border-card1/20 bg-mrow/60 p-3.5 sm:p-5 backdrop-blur-md transition hover:border-amber-400/30">
            <p className="text-lg sm:text-2xl font-black text-Eltext1">{activeTrackId ? formatNumber(activeTrackDownloads) : '—'}</p>
            <p className="mt-1 text-[11px] sm:text-xs font-medium text-Eltext1 flex items-center gap-1.5 truncate">
              <Download size={13} className="shrink-0 text-amber-400" /> <span className="truncate">Song Downloads</span>
            </p>
          </div>
        </div>

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
            <div className="space-y-4">
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
                    onPlay={() => void refreshTrackDownloads(track.id, track.fileUrl || '')}
                    onDownload={() => void refreshTrackDownloads(track.id, track.fileUrl || '')}
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
