import { NextResponse } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY ?? process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? process.env.VITE_YOUTUBE_API_KEY ?? "";
const DEFAULT_CHANNEL_ID = "UCDwZ_ENzU7LIDA5F8EYf1Jg";

type Cached = {
  expires: number;
  data: any;
};

const cache = new Map<string, Cached>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function fetchAllVideos(channelId: string) {
  const videos: any[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const params = new URLSearchParams({
      key: API_KEY,
      channelId,
      part: "snippet,id",
      order: "date",
      maxResults: "50",
      type: "video",
    });

    if (nextPageToken) params.set("pageToken", nextPageToken);

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = payload?.error?.message ?? "YouTube API error";
      throw new Error(msg);
    }

    const items = payload?.items ?? [];
    for (const item of items) {
      const videoId = item?.id?.videoId ?? "";
      const snippet = item?.snippet ?? {};
      const thumbnail = snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.default?.url ?? "";

      if (!videoId) continue;

      videos.push({
        id: videoId,
        title: snippet.title ?? "",
        subtitle: snippet.description ?? "",
        thumbnail,
        date: snippet.publishedAt ? new Date(snippet.publishedAt).toISOString() : "",
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    nextPageToken = payload?.nextPageToken;
  } while (nextPageToken);

  return videos;
}

export async function GET(req: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: "Server not configured with YouTube API key" }, { status: 500 });
  }

  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? DEFAULT_CHANNEL_ID;

  const cached = cache.get(channelId);
  const now = Date.now();
  if (cached && cached.expires > now) {
    return NextResponse.json({ videos: cached.data });
  }

  try {
    const videos = await fetchAllVideos(channelId);
    cache.set(channelId, { expires: now + CACHE_TTL, data: videos });
    return NextResponse.json({ videos });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 502 });
  }
}
