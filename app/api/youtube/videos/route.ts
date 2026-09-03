import { NextResponse } from "next/server";
import { ClientType, Innertube } from "youtubei.js";
import { buildMegaShorts } from "@/lib/video-feed";
import { resolveAllowedOrigin } from '@/lib/request-origin';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_CHANNEL_ID = "UCDwZ_ENzU7LIDA5F8EYf1Jg";

type YouTubeVideo = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  date: string;
  url: string;
  type: "short" | "official";
  durationSeconds: number;
  views?: number;
};

let youtubeClientPromise: Promise<Innertube> | undefined;
function getYoutubeClient() {
  youtubeClientPromise ??= Innertube.create({ client_type: ClientType.ANDROID_VR, retrieve_player: true });
  return youtubeClientPromise;
}

async function fetchAllVideosWithInnertube(channelId: string): Promise<YouTubeVideo[]> {
  try {
    const youtube = await getYoutubeClient();

    // Try uploads playlist (common pattern: uploads playlist id = 'UU' + channelId.slice(2) when channelId starts with 'UC')
    const videos: Omit<YouTubeVideo, "type" | "durationSeconds">[] = [];
    if (channelId.startsWith("UC")) {
      const uploadPlaylistId = `UU${channelId.slice(2)}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pl = await (youtube as any).getPlaylist(uploadPlaylistId);
        const addItems = (items: unknown[]) => {
          for (const it of items) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = it as any;
            const vid = item?.id || item?.videoId || item?.video?.id || (item?.navigationEndpoint?.watchEndpoint?.videoId);
            const title = item?.title?.simpleText || item?.title || item?.video?.title || item?.snippet?.title || '';
            const thumbnails = item?.thumbnail?.thumbnails || item?.thumbnails || item?.video?.thumbnail || item?.snippet?.thumbnails || {};
            const thumb = (thumbnails?.maxres?.url) || (thumbnails?.high?.url) || (thumbnails?.default?.url) || '';
            const published = item?.published || item?.video?.published || item?.snippet?.publishedAt || '';
            if (!vid || videos.some((video) => video.id === String(vid))) continue;
            videos.push({ id: String(vid), title: String(title || vid), subtitle: '', thumbnail: thumb, date: published, url: `https://www.youtube.com/watch?v=${vid}` });
          }
        };

        while (videos.length < 200) {
          const items = pl?.contents?.items || pl?.playlist?.items || pl?.videos || [];
          addItems(items);
          if (!pl?.has_continuation) break;
          pl = await pl.getContinuation();
        }
      } catch {
        // ignore and fallthrough to search
      }
    }

    // If uploads not found or empty, fall back to searching the channel's name/id
    if (videos.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let search = await (youtube as any).search(channelId);
      while (videos.length < 200) {
        const items = search?.contents || search?.results || search || [];
        for (const it of items) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const item = it as any;
          const vid = item?.id || item?.videoId || item?.video?.id || (item?.navigationEndpoint?.watchEndpoint?.videoId) || (item?.id?.videoId);
          const title = item?.title?.simpleText || item?.title || item?.video?.title || item?.snippet?.title || '';
          const thumbnails = item?.thumbnail?.thumbnails || item?.thumbnails || item?.video?.thumbnail || item?.snippet?.thumbnails || {};
          const thumb = (thumbnails?.maxres?.url) || (thumbnails?.high?.url) || (thumbnails?.default?.url) || '';
          const published = item?.published || item?.video?.published || item?.snippet?.publishedAt || '';
          if (!vid || videos.some((video) => video.id === String(vid))) continue;
          videos.push({ id: String(vid), title: String(title || vid), subtitle: '', thumbnail: thumb, date: published, url: `https://www.youtube.com/watch?v=${vid}` });
        }

        if (!search?.has_continuation) break;
        search = await search.getContinuation();
      }
    }

    // limit and normalize
    return videos.slice(0, 200).map((v) => ({ ...v, type: 'official', durationSeconds: 0 }));
  } catch (err) {
    console.warn('Innertube fallback failed:', err);
    return [];
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchVideosFromRss(channelId: string): Promise<YouTubeVideo[]> {
  const response = await fetchWithTimeout(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    { headers: { Accept: 'application/atom+xml' } },
    10000,
  );
  if (!response.ok) throw new Error(`YouTube RSS returned status ${response.status}`);

  const xml = await response.text();
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).map((match) => match[1]).flatMap((entry) => {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    if (!videoId) return [];

    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || videoId;
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] || '';
    const thumbnail = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return [{
      id: videoId,
      title: decodeXml(title),
      subtitle: '',
      thumbnail: decodeXml(thumbnail),
      date: published,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      type: 'official' as const,
      durationSeconds: 0,
    }];
  });
}

function getFallbackFeed() {
  const fallbackVideos: YouTubeVideo[] = [
    {
      id: "fallback-1",
      title: "Noll Studio Uganda highlights",
      subtitle: "A curated showcase while the YouTube API is unavailable.",
      thumbnail:
        "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      url: "https://www.youtube.com/@Nollvisuals",
      type: "official",
      durationSeconds: 180,
    },
  ];

  return {
    videos: fallbackVideos,
    shorts: buildMegaShorts() as YouTubeVideo[],
  };
}

function getYoutubeApiKey(): string {
  return (
    process.env.YOUTUBE_API_KEY ??
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ??
    process.env.VITE_YOUTUBE_API_KEY ??
    ""
  ).trim();
}

function withCors(response: NextResponse, request: Request): NextResponse {
  const origin = request.headers.get("origin");
  const allowOrigin = resolveAllowedOrigin(origin);

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

function parseISODuration(duration: string): number {
  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!matches) return 0;
  const hours = Number(matches[1] ?? "0");
  const minutes = Number(matches[2] ?? "0");
  const seconds = Number(matches[3] ?? "0");
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchVideoDurations(
  videoIds: string[]
): Promise<Record<string, number>> {
  const durations: Record<string, number> = {};
  const apiKey = getYoutubeApiKey();
  const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));

  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batchIds = uniqueIds.slice(i, i + 50).join(",");
    const params = new URLSearchParams({
      key: apiKey,
      id: batchIds,
      part: "contentDetails",
      maxResults: "50",
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`
    );
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        payload?.error?.message ?? "YouTube API error fetching video durations";
      throw new Error(msg);
    }

    const items = payload?.items ?? [];
    for (const item of items) {
      const id = item?.id as string | undefined;
      const duration = item?.contentDetails?.duration as string | undefined;
      if (!id || !duration) continue;
      durations[id] = parseISODuration(duration);
    }
  }

  return durations;
}

async function fetchVideoDetails(videoIds: string[]) {
  const details: Record<string, { duration: number; views: number; thumbnail?: string }> = {};
  const apiKey = getYoutubeApiKey();
  const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));

  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batchIds = uniqueIds.slice(i, i + 50).join(',');
    const params = new URLSearchParams({
      key: apiKey,
      id: batchIds,
      part: 'contentDetails,statistics,snippet',
      maxResults: '50',
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = payload?.error?.message ?? 'YouTube API error fetching video details';
      throw new Error(msg);
    }

    const items = payload?.items ?? [];
    for (const item of items) {
      const id = item?.id as string | undefined;
      if (!id) continue;
      const durationIso = item?.contentDetails?.duration as string | undefined;
      const duration = durationIso ? parseISODuration(durationIso) : 0;
      const views = Number(item?.statistics?.viewCount ?? 0);
      const thumb =
        (item?.snippet?.thumbnails?.maxres?.url as string) ??
        (item?.snippet?.thumbnails?.high?.url as string) ??
        (item?.snippet?.thumbnails?.default?.url as string) ??
        undefined;

      details[id] = { duration, views, thumbnail: thumb };
    }
  }

  return details;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllVideos(channelId: string): Promise<YouTubeVideo[]> {
  const apiKey = getYoutubeApiKey();
  const videos: Omit<YouTubeVideo, "type" | "durationSeconds">[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;

  while (pageCount < 5) {
    const params = new URLSearchParams({
      key: apiKey,
      playlistId: `UU${channelId.slice(2)}`,
      part: "snippet",
      maxResults: "50",
    });

    if (nextPageToken) {
      params.set("pageToken", nextPageToken);
    }

    const res = await fetchWithTimeout(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      {},
      10000
    );
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = payload?.error?.message ?? "YouTube API error";
      throw new Error(msg);
    }

    const items = payload?.items ?? [];
    for (const item of items) {
      const videoId = (item?.snippet?.resourceId?.videoId as string) ?? "";
      const snippet = item?.snippet ?? {};
      const thumbnail =
        (snippet?.thumbnails?.high?.url as string) ??
        (snippet?.thumbnails?.default?.url as string) ??
        "";

      if (!videoId) continue;

      videos.push({
        id: videoId,
        title: (snippet.title as string) ?? "",
        subtitle: (snippet.description as string) ?? "",
        thumbnail,
        date: snippet.publishedAt
          ? new Date(snippet.publishedAt as string).toISOString()
          : "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    nextPageToken = payload?.nextPageToken as string | undefined;
    if (!nextPageToken) break;
    pageCount += 1;
  }

  const ids = videos.map((video) => video.id);
  const [detailsMap, durationMap] = await Promise.all([
    fetchVideoDetails(ids).catch(() => ({} as Record<string, { duration: number; views: number; thumbnail?: string }>)),
    fetchVideoDurations(ids).catch(() => ({} as Record<string, number>)),
  ]);

  return videos.map((video) => {
    const details = detailsMap[video.id] ?? { duration: durationMap[video.id] ?? 0, views: 0 };
    const durationSeconds = details.duration ?? durationMap[video.id] ?? 0;

    return {
      ...video,
      thumbnail: details.thumbnail ?? video.thumbnail,
      type: "official",
      durationSeconds,
      views: details.views ?? 0,
    };
  });
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? DEFAULT_CHANNEL_ID;

  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    const videos = await fetchAllVideosWithInnertube(channelId);
    const rssVideos = videos.length > 0 ? videos : await fetchVideosFromRss(channelId).catch(() => []);
    const liveFeed = rssVideos.length > 0 ? { videos: rssVideos, shorts: [] } : null;
    const fallbackFeed = liveFeed ?? getFallbackFeed();
    return withCors(
      NextResponse.json({ videos: fallbackFeed.videos, shorts: fallbackFeed.shorts, fallback: !liveFeed }),
      req
    );
  }

  try {
    const videos = await fetchAllVideos(channelId);
    const payload = {
      videos,
      shorts: [],
    };
    return withCors(NextResponse.json({ videos: payload.videos, shorts: payload.shorts, fallback: false }), req);
  } catch (err: unknown) {
    const videos = await fetchAllVideosWithInnertube(channelId);
    const rssVideos = videos.length > 0 ? videos : await fetchVideosFromRss(channelId).catch(() => []);
    const liveFeed = rssVideos.length > 0 ? { videos: rssVideos, shorts: [] } : null;
    const fallbackFeed = liveFeed ?? getFallbackFeed();
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    console.warn(`YouTube videos fallback active: ${errorMessage}`);
    return withCors(
      NextResponse.json({ videos: fallbackFeed.videos, shorts: fallbackFeed.shorts, fallback: !liveFeed, error: errorMessage }),
      req
    );
  }
}