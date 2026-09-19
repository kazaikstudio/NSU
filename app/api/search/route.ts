import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { fetchChannelVideos } from '@/lib/youtube-channel';
import { getStoredThumbnailUrl } from '@/lib/media-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SearchTrack {
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
  playCount?: number;
}

interface SearchVideo {
  id: string;
  title: string;
  thumbnail: string;
  date: string;
  url: string;
  type?: 'short' | 'official';
  views?: number;
  fileUrl?: string;
  source?: 'youtube' | 'talk-show';
}

interface SearchArtist {
  id: string;
  name: string;
  genre: string;
  tracksCount: number;
  status: string;
  profileUrl?: string | null;
}

function normalizeQuery(value: string | null | undefined) {
  return (value ?? '').trim().slice(0, 100);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// The YouTube channel feed lives outside our own infrastructure and can hang
// for a very long time (youtubei.js session setup, slow Google API responses,
// etc.). Global search must never wait on it — cap it and cache the outcome so
// a slow/blocked feed turns into fast, empty video results instead of a 90s
// spinner.
const CHANNEL_SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_CHANNEL_TIMEOUT_MS || 6000);
const CHANNEL_SEARCH_CACHE_TTL_MS = 60_000;

function withTimeoutFallback<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function searchAudioTracks(term: string, limit: number): Promise<SearchTrack[]> {
  await ensureDatabaseReady();
  const pattern = `%${escapeLike(term)}%`;

  const { rows } = await pool.query(
    `SELECT
        media.id,
        media.title,
        media.album,
        media.file_name AS "fileName",
        media.file_url AS "fileUrl",
        media.drive_file_id AS "driveFileId",
        media.download_count AS "downloadCount",
        media.play_count AS "playCount",
        media.thumbnail_url AS "thumbnailUrl",
        media.thumbnail_drive_file_id AS "thumbnailDriveFileId",
        media.featured_artist_name AS "featuredArtistName",
        media.created_at AS "createdAt",
        artist.id::text AS "artistId",
        artist.name AS "artistName",
        artist.genre AS "artistGenre",
        artist.profile_url AS "artistProfileUrl"
      FROM artist_media AS media
      INNER JOIN artists AS artist ON artist.id::text = media.artist_id
      WHERE media.kind = 'track'
        AND (
          media.title ILIKE $1
          OR media.album ILIKE $1
          OR media.featured_artist_name ILIKE $1
          OR media.file_name ILIKE $1
          OR artist.name ILIKE $1
        )
      ORDER BY media.created_at DESC
      LIMIT $2`,
    [pattern, limit],
  );

  return rows.map((track) => ({
    id: track.id,
    title: track.title,
    album: track.album ?? null,
    fileName: track.fileName,
    fileUrl: track.fileUrl,
    createdAt: track.createdAt,
    artistId: track.artistId,
    artistName: track.artistName,
    featuredArtistName: track.featuredArtistName ?? null,
    artistGenre: track.artistGenre ?? null,
    artistProfileUrl: track.artistProfileUrl ?? null,
    thumbnailUrl: track.thumbnailUrl ?? null,
    downloadCount: Number(track.downloadCount || 0),
    playCount: Number(track.playCount || 0),
  }));
}

async function searchStorageMusic(term: string, limit: number): Promise<SearchTrack[]> {
  await ensureDatabaseReady();
  const pattern = `%${escapeLike(term)}%`;

  const { rows } = await pool.query(
    `SELECT title, file_url AS "fileUrl", thumbnail_url AS "thumbnailUrl"
     FROM storage_items
     WHERE LOWER(type) = 'music' AND title ILIKE $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [pattern, limit],
  );

  return rows.map((item) => ({
    id: `storage-${item.fileUrl}`,
    title: item.title,
    album: null,
    fileName: item.fileUrl.split('/').pop() || `${item.title}.mp3`,
    fileUrl: item.fileUrl,
    createdAt: new Date().toISOString(),
    artistId: 'noll-studio',
    artistName: 'Noll Studio',
    featuredArtistName: null,
    artistGenre: 'Music',
    artistProfileUrl: null,
    thumbnailUrl: getStoredThumbnailUrl(item.fileUrl, item.thumbnailUrl, 400),
    downloadCount: 0,
    playCount: 0,
  }));
}

async function searchStorageVideos(term: string, limit: number): Promise<SearchVideo[]> {
  await ensureDatabaseReady();
  const pattern = `%${escapeLike(term)}%`;

  // Uploaded videos live in the bucket under the "videos/" folder, but the
  // storage_items.type column has historically been tagged 'music' for those
  // rows. Classify by content (bucket folder / URL) so the site's own video
  // library — talk-shows, official uploads — actually shows up in search.
  const { rows } = await pool.query(
    `SELECT
        id,
        title,
        file_url AS "fileUrl",
        thumbnail_url AS "thumbnailUrl",
        source,
        created_at AS "createdAt"
      FROM storage_items
      WHERE title ILIKE $1
        AND (
          LOWER(type) = 'video'
          OR LOWER(file_url) LIKE '%videos%2f%'
          OR drive_file_id LIKE 'videos/%'
        )
      ORDER BY created_at DESC
      LIMIT $2`,
    [pattern, limit],
  );

  return rows.map((item) => ({
    id: String(item.id),
    title: item.title,
    thumbnail: getStoredThumbnailUrl(item.fileUrl, item.thumbnailUrl, 640),
    date: item.createdAt,
    url: item.fileUrl,
    fileUrl: item.fileUrl,
    type: 'official' as const,
    views: undefined,
    source: 'talk-show' as const,
  }));
}

async function searchArtists(term: string, limit: number): Promise<SearchArtist[]> {
  await ensureDatabaseReady();
  const pattern = `%${escapeLike(term)}%`;

  const { rows } = await pool.query(
    `SELECT
        id::text AS id,
        name,
        genre,
        tracks_count AS "tracksCount",
        status,
        profile_url AS "profileUrl"
      FROM artists
      WHERE name ILIKE $1 OR genre ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [pattern, limit],
  );

  return rows.map((artist) => ({
    id: artist.id,
    name: artist.name,
    genre: artist.genre,
    tracksCount: Number(artist.tracksCount || 0),
    status: artist.status || 'Active',
    profileUrl: artist.profileUrl ?? null,
  }));
}

let channelFeedCache: { videos: SearchVideo[]; fetchedAt: number } | undefined;
let channelFeedInFlight: Promise<SearchVideo[]> | undefined;

// The channel feed is identical for every query term, so fetch it once and
// filter per term. Cache both the success and the empty/timeout outcome so a
// sluggish YouTube API can't stall a typing session more than once per window.
async function getChannelFeedVideos(): Promise<SearchVideo[]> {
  const now = Date.now();
  if (channelFeedCache && now - channelFeedCache.fetchedAt < CHANNEL_SEARCH_CACHE_TTL_MS) {
    return channelFeedCache.videos;
  }

  if (!channelFeedInFlight) {
    channelFeedInFlight = (async () => {
      const feed = await withTimeoutFallback(fetchChannelVideos(), CHANNEL_SEARCH_TIMEOUT_MS);
      const videos: SearchVideo[] = feed
        ? [...feed.videos, ...feed.shorts].map((video) => ({
            id: video.id,
            title: video.title,
            thumbnail: video.thumbnail,
            date: video.date,
            url: video.url,
            type: video.type === 'short' ? ('short' as const) : ('official' as const),
            views: video.views && video.views > 0 ? video.views : undefined,
            source: 'youtube' as const,
          }))
        : [];
      channelFeedCache = { videos, fetchedAt: Date.now() };
      return videos;
    })();
  }

  try {
    return await channelFeedInFlight;
  } finally {
    channelFeedInFlight = undefined;
  }
}

async function searchChannelVideos(term: string, limit: number): Promise<SearchVideo[]> {
  try {
    const videos = await getChannelFeedVideos();
    const pattern = term.toLowerCase();
    return videos
      .filter((video) => video.title?.toLowerCase().includes(pattern))
      .slice(0, limit);
  } catch (error) {
    console.warn('Channel video lookup failed:', error);
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeQuery(url.searchParams.get('q'));
  const requestedLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 30) : 12;

  if (!query) {
    return NextResponse.json({ tracks: [], artists: [], videos: [], error: 'Missing search query' }, { status: 400 });
  }

  let tracks: SearchTrack[] = [];
  let artists: SearchArtist[] = [];
  let storageItems: SearchTrack[] = [];
  let storageVideos: SearchVideo[] = [];
  let dbAvailable = true;

  // All database work shares a single connection/recovery attempt: if Postgres
  // is slow to wake (Railway cold start) the request pays at most one reconnect
  // window instead of one per query, and the channel-video fetch below stays
  // independently capped so it can never hold the response hostage.
  const videoLimit = Math.max(limit, 8);
  const taskLimit = Math.max(limit, 12);
  try {
    const [trackRows, artistRows, storageRows, storageVideoRows] = await Promise.all([
      searchAudioTracks(query, taskLimit),
      searchArtists(query, taskLimit),
      searchStorageMusic(query, 5),
      searchStorageVideos(query, videoLimit),
    ]);
    tracks = trackRows;
    artists = artistRows;
    storageItems = storageRows;
    storageVideos = storageVideoRows;
  } catch (error) {
    console.warn('Database search failed:', error);
    dbAvailable = false;
  }

  // Videos come only from the site's own library: uploaded video items plus the
  // channel feed — never from arbitrary external YouTube searches. The channel
  // fetch is time-capped and cached so a slow YouTube API degrades to "no
  // channel results" instead of stalling the whole search.
  const channelVideos = await searchChannelVideos(query, videoLimit);
  const videos = [...storageVideos, ...channelVideos].slice(0, videoLimit);

  const trackById = new Map<string, SearchTrack>();
  for (const track of [...tracks, ...storageItems]) {
    if (!trackById.has(track.id)) trackById.set(track.id, track);
  }

  return NextResponse.json(
    {
      tracks: Array.from(trackById.values()),
      artists,
      videos,
      dbAvailable,
    },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' } }
  );
}