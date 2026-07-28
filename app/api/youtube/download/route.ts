import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import { Readable } from "stream";

export const maxDuration = 60; // Allow long-running stream execution
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = [
  "https://nollstudios.org",
  "https://www.nollstudios.org",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// Read YouTube Cookies from Railway Environment Variables
const cookiesEnv = process.env.YOUTUBE_COOKIES;
let agent: ReturnType<typeof ytdl.createAgent> | undefined = undefined;

if (cookiesEnv) {
  try {
    const parsedCookies = JSON.parse(cookiesEnv);
    agent = ytdl.createAgent(parsedCookies);
  } catch (err) {
    console.error("Failed to parse YOUTUBE_COOKIES environment variable:", err);
  }
}

// Helper to attach CORS headers
function withCors(response: NextResponse | Response, request: Request) {
  const origin = request.headers.get("origin");
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

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
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id") || searchParams.get("videoId");
  const format = searchParams.get("format")?.toLowerCase() || "720p";

  if (!id) {
    return withCors(
      NextResponse.json({ error: "Missing video 'id' parameter" }, { status: 400 }),
      req
    );
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${id}`;

    if (!ytdl.validateID(id) && !ytdl.validateURL(videoUrl)) {
      return withCors(
        NextResponse.json({ error: "Invalid YouTube Video ID" }, { status: 400 }),
        req
      );
    }

    // Fetch video information using the Cookie Agent
    const info = await ytdl.getInfo(videoUrl, { agent });
    const cleanTitle = (info.videoDetails.title || "video").replace(/[^a-zA-Z0-9_ -]/g, "");

    const downloadOptions: ytdl.downloadOptions = { agent };

    let contentType = "video/mp4";
    let fileExtension = "mp4";

    if (format === "mp3") {
      contentType = "audio/mpeg";
      fileExtension = "mp3";
      downloadOptions.filter = "audioonly";
      downloadOptions.quality = "highestaudio";
    } else {
      const combinedFormats = info.formats.filter(
        (f) => f.hasVideo && f.hasAudio
      );

      let targetFormat = null;
      if (format === "1080p") {
        targetFormat = combinedFormats.find((f) => f.qualityLabel?.includes("1080p"));
      } else if (format === "720p") {
        targetFormat = combinedFormats.find((f) => f.qualityLabel?.includes("720p"));
      }

      if (targetFormat) {
        downloadOptions.format = targetFormat;
      } else if (combinedFormats.length > 0) {
        downloadOptions.filter = "audioandvideo";
        downloadOptions.quality = "highest";
      } else {
        downloadOptions.filter = "videoonly";
        downloadOptions.quality = "highestvideo";
      }
    }

    // 1. Get Node.js Readable Stream
    const nodeStream = ytdl(videoUrl, downloadOptions);
    const filename = `${cleanTitle}.${fileExtension}`;

    // 2. Safely convert Node Stream to Web ReadableStream
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    // 3. Construct Web Response
    const response = new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Access-Control-Expose-Headers": "Content-Disposition",
      },
    });

    return withCors(response, req);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process download stream";
    console.error("Download route error:", error);

    return withCors(
      NextResponse.json({ error: errorMessage }, { status: 500 }),
      req
    );
  }
}