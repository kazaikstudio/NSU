import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_CHANNEL_ID = "UCDwZ_ENzU7LIDA5F8EYf1Jg";
const ALLOWED_ORIGINS = [
  "https://nollstudios.org",
  "https://www.nollstudios.org",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

type YouTubeVideo = {
  id: string;
  title: string;
  subtitle: string;
  thumbnail: string;
  date: string;
  url: string;
  type: "short" | "official";
  durationSeconds: number;
};

type Cached = {
  expires: number;
  data: YouTubeVideo[];
};

const cache = new Map<string, Cached>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

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
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

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

async function fetchAllVideos(channelId: string): Promise<YouTubeVideo[]> {
  const apiKey = getYoutubeApiKey();
  const videos: Omit<YouTubeVideo, "type" | "durationSeconds">[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams({
      key: apiKey,
      channelId,
      part: "snippet,id",
      order: "date",
      maxResults: "50",
      type: "video",
    });

    if (nextPageToken) params.set("pageToken", nextPageToken);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
    );
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = payload?.error?.message ?? "YouTube API error";
      throw new Error(msg);
    }

    const items = payload?.items ?? [];
    for (const item of items) {
      const videoId = (item?.id?.videoId as string) ?? "";
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
  } while (nextPageToken);

  const durationMap = await fetchVideoDurations(
    videos.map((video) => video.id)
  );
  const shortTitlePattern = /(?:#shorts?\b|\bshorts?\b)/i;

  return videos.map((video) => {
    const durationSeconds = durationMap[video.id] ?? 0;
    const isShort =
      durationSeconds > 0
        ? durationSeconds <= 60
        : shortTitlePattern.test(video.title);

    return {
      ...video,
      type: isShort ? "short" : "official",
      durationSeconds,
    };
  });
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function GET(req: Request) {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) {
    return withCors(
      NextResponse.json(
        {
          error:
            "Server not configured with YouTube API key. Set YOUTUBE_API_KEY in Railway environment variables.",
        },
        { status: 500 }
      ),
      req
    );
  }

  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? DEFAULT_CHANNEL_ID;

  const cached = cache.get(channelId);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return withCors(NextResponse.json({ videos: cached.data }), req);
  }

  try {
    const videos = await fetchAllVideos(channelId);
    cache.set(channelId, { expires: now + CACHE_TTL, data: videos });
    return withCors(NextResponse.json({ videos }), req);
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return withCors(
      NextResponse.json({ error: errorMessage }, { status: 502 }),
      req
    );
  }
}