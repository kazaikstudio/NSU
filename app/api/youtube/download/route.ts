import { NextResponse } from "next/server";
import { ClientType, Innertube } from "youtubei.js";

export const maxDuration = 60; // Extend serverless limit
export const dynamic = "force-dynamic";

let youtubeClientPromise: Promise<Innertube> | undefined;

function getYoutubeClient() {
  youtubeClientPromise ??= Innertube.create({ client_type: ClientType.ANDROID_VR, retrieve_player: true });
  return youtubeClientPromise;
}

const ALLOWED_ORIGINS = [
  "https://nollstudios.org",
  "https://www.nollstudios.org",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

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
  const itag = Number(searchParams.get("itag"));
  if (!id) {
    return withCors(
      NextResponse.json({ error: "Missing video 'id' parameter" }, { status: 400 }),
      req
    );
  }

  try {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      return withCors(
        NextResponse.json({ error: "Invalid YouTube Video ID" }, { status: 400 }),
        req
      );
    }

    const youtube = await getYoutubeClient();
    const info = await youtube.getBasicInfo(id);
    const availableFormats = [
      ...(info.streaming_data?.formats || []),
      ...(info.streaming_data?.adaptive_formats || []),
    ];
    const selectedFormat = availableFormats.find((format) => format.itag === itag);
    const stream = await info.download({
      ...(Number.isInteger(itag) && itag > 0
        ? { itag }
        : { type: "video+audio", quality: "best", format: "mp4" }),
    });
    const title = info.basic_info.title || `youtube-${id}`;
    const safeTitle = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim() || `youtube-${id}`;
    const [mimeType] = selectedFormat?.mime_type?.split(';') || ['video/mp4'];
    const extension = mimeType.split('/')[1] || 'mp4';
    const encodedFilename = encodeURIComponent(`${safeTitle}.${extension}`);

    const response = new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="video-${id}.${extension}"; filename*=UTF-8''${encodedFilename}`,
        "Access-Control-Expose-Headers": "Content-Disposition",
      },
    });

    return withCors(response, req);
  } catch (error: unknown) {
    console.error("Download route error:", error);
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to process download stream" },
        { status: 500 }
      ),
      req
    );
  }
}