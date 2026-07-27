import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

const ALLOWED_ORIGINS = ["https://nollstudios.org", "https://www.nollstudios.org", "http://localhost:3000", "http://127.0.0.1:3000"];

function withCors(response: NextResponse, request: Request) {
  const origin = request.headers.get("origin");
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  try {
    const info = await ytdl.getInfo(videoId);
    const formats = info.formats ?? [];

    // prefer combined audio+video, but include others
    const candidates = formats
      .filter((f) => !!f.url)
      .map((f) => ({
        itag: f.itag,
        container: f.container,
        qualityLabel: (f as any).qualityLabel ?? null,
        mimeType: f.mimeType ?? null,
        contentLength: (f as any).contentLength ?? null,
        url: f.url,
      }));

    const streams = candidates.map((s) => ({
      label: s.qualityLabel ?? `${s.container ?? ""}`,
      size: s.contentLength ? `${(Number(s.contentLength) / (1024 * 1024)).toFixed(2)} MB` : undefined,
      url: s.url,
      itag: s.itag,
    }));

    return withCors(NextResponse.json({ streams }), req);
  } catch (err: any) {
    return withCors(NextResponse.json({ error: err?.message ?? "Failed to get video streams" }, { status: 502 }), req);
  }
}
