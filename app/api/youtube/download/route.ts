import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { Readable } from "stream";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Safely parse cookies with correct return type
const cookiesEnv = process.env.YOUTUBE_COOKIES;
let agent: ReturnType<typeof ytdl.createAgent> | undefined = undefined;

if (cookiesEnv) {
  try {
    const parsedCookies = JSON.parse(cookiesEnv);
    agent = ytdl.createAgent(parsedCookies);
  } catch (err) {
    console.error("Failed to parse YOUTUBE_COOKIES:", err);
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") || searchParams.get("videoId");
  const format = searchParams.get("format")?.toLowerCase() || "720p";

  if (!id) {
    return NextResponse.json({ error: "Missing video id" }, { status: 400 });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;

    const info = await ytdl.getInfo(videoUrl, { agent });
    const cleanTitle = (info.videoDetails.title || "video").replace(/[^a-zA-Z0-9_ -]/g, "");

    const downloadOptions: ytdl.downloadOptions = { agent };

    if (format === "mp3") {
      downloadOptions.filter = "audioonly";
      downloadOptions.quality = "highestaudio";
    } else {
      downloadOptions.filter = "audioandvideo";
      downloadOptions.quality = "highest";
    }

    // 1. Fetch Node.js Readable Stream
    const nodeStream = ytdl(videoUrl, downloadOptions);

    // 2. Convert Node stream to Web Stream safely without using 'any'
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    const extension = format === "mp3" ? "mp3" : "mp4";
    const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(cleanTitle)}.${extension}"`,
      },
    });
  } catch (error: unknown) {
    // 3. Type-safe error handling without 'error: any'
    const errorMessage = error instanceof Error ? error.message : "Failed to download media";
    console.error("Download Error:", error);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}