import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';
import { ClientType, Innertube } from 'youtubei.js';
import { configureYoutubeEvaluator, getYoutubeSessionConfig } from '@/lib/youtube-client';

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
  source?: 'youtube';
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
    thumbnailUrl: item.thumbnailUrl ?? null,
    downloadCount: 0,
    playCount: 0,
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

let youtubeClientPromise: Promise<Innertube> | undefined;
function getYoutubeClient() {
  configureYoutubeEvaluator();
  youtubeClientPromise ??= Innertube.create({
    client_type: ClientType.ANDROID_VR,
    retrieve_player: true,
    ...getYoutubeSessionConfig(),
  });
  return youtubeClientPromise;
}

function textToPlain(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const text = value as { toString?: () => string; text?: unknown };
  try {
    if (typeof text.toString === 'function') {
      const plain = text.toString();
      if (plain) return plain;
    }
  } catch {
    // fall through
  }
  return typeof text.text === 'string' ? text.text : '';
}

async function searchYoutubeVideos(term: string, limit: number): Promise<SearchVideo[]> {
  try {
    const youtube = await getYoutubeClient();
    const search = await youtube.search(term);

    const results: SearchVideo[] = [];
    for (const node of (search?.results ?? []) as unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = node as any;
      const videoId =
        typeof item.video_id === 'string' && item.video_id
          ? item.video_id
          : typeof item.id === 'string' && item.id
            ? item.id
            : typeof item.id?.value === 'string'
              ? item.id.value
              : undefined;
      if (!videoId) continue;

      const title = textToPlain(item.title);
      if (!title) continue;

      const thumbnails: Array<{ url?: string; width?: number; height?: number }> = Array.isArray(item.thumbnails)
        ? item.thumbnails
        : [];
      const thumbnail =
        item.best_thumbnail?.url ||
        thumbnails.find((thumb) => thumb?.width && thumb.width >= 320)?.url ||
        thumbnails.at(-1)?.url ||
        thumbnails[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const viewsText = textToPlain(item.view_count ?? item.short_view_count);
      const views = Number.parseInt(viewsText.replace(/[^\d]/g, '') || '0', 10) || undefined;
      const durationSeconds = Number(item.duration?.seconds) || 0;
      const published = textToPlain(item.published);

      results.push({
        id: String(videoId),
        title,
        thumbnail,
        date: published,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        type: durationSeconds > 0 && durationSeconds <= 60 ? 'short' : 'official',
        views,
        source: 'youtube',
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch (error) {
    console.warn('YouTube search failed:', error);
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

  const videoLimit = Math.max(limit, 8);
  const videos = await searchYoutubeVideos(query, videoLimit);

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