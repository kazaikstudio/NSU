import { NextResponse } from "next/server";
import { DEFAULT_CHANNEL_ID, fetchChannelVideos } from '@/lib/youtube-channel';
import { resolveAllowedOrigin } from '@/lib/request-origin';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function withFeedHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Cache-Control",
    "public, max-age=60, s-maxage=600, stale-while-revalidate=86400"
  );
  return response;
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channelId = url.searchParams.get("channelId") ?? DEFAULT_CHANNEL_ID;

  const feed = await fetchChannelVideos(channelId);

  return withCors(
    withFeedHeaders(
      NextResponse.json({
        videos: feed.videos,
        shorts: feed.shorts,
        fallback: feed.fallback,
        ...(feed.error ? { error: feed.error } : {}),
      })
    ),
    req
  );
}