import { NextResponse } from "next/server";
import ytdl from "ytdl-core";

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

    return NextResponse.json({ streams });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to get video streams" }, { status: 502 });
  }
}
