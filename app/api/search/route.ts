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

  const { rows } = await pool.query(
    `SELECT
        id,
        title,
        file_url AS "fileUrl",
        thumbnail_url AS "thumbnailUrl",
        source,
        created_at AS "createdAt"
      FROM storage_items
      WHERE LOWER(type) = 'video' AND title ILIKE $1
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

async function searchChannelVideos(term: string, limit: number): Promise<SearchVideo[]> {
  try {
    const feed = await fetchChannelVideos();
    const pattern = term.toLowerCase();

    const matches = [...feed.videos, ...feed.shorts].filter((video) =>
      video.title?.toLowerCase().includes(pattern),
    );

    return matches.slice(0, limit).map((video) => ({
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      date: video.date,
      url: video.url,
      type: video.type === 'short' ? ('short' as const) : ('official' as const),
      views: video.views && video.views > 0 ? video.views : undefined,
      source: 'youtube' as const,
    }));
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
  let dbAvailable = true;

  try {
    const taskLimit = Math.max(limit, 12);
    const [trackRows, artistRows, storageRows] = await Promise.all([
      searchAudioTracks(query, taskLimit),
      searchArtists(query, taskLimit),
      searchStorageMusic(query, 5),
    ]);
    tracks = trackRows;
    artists = artistRows;
    storageItems = storageRows;
  } catch (error) {
    console.warn('Database search failed:', error);
    dbAvailable = false;
  }

  // Videos come only from the site's own library: uploaded video items plus
  // the channel feed — never from arbitrary external YouTube searches.
  const videoLimit = Math.max(limit, 8);
  const [storageVideos, channelVideos] = await Promise.all([
    searchStorageVideos(query, videoLimit).catch(() => []),
    searchChannelVideos(query, videoLimit),
  ]);
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