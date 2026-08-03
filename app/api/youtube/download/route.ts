import { NextResponse } from "next/server";
import { ClientType, Innertube } from "youtubei.js";
import ffmpegPath from "ffmpeg-static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import { ensureDownloadStoragePath, teeStreamToFile } from "@/lib/download-storage";

export const maxDuration = 60; // Extend serverless limit
export const dynamic = "force-dynamic";

let youtubeClientPromise: Promise<Innertube> | undefined;

function getYoutubeClient() {
  youtubeClientPromise ??= Innertube.create({ client_type: ClientType.ANDROID_VR, retrieve_player: true });
  return youtubeClientPromise;
}

function getFfmpegPath() {
  const localPath = join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
  return [process.env.FFMPEG_PATH, localPath, ffmpegPath].find((path): path is string => Boolean(path && existsSync(path)));
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
  const output = searchParams.get("output") || "mp4";
  const bitrate = Number(searchParams.get("bitrate")) || 192;
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
    if (!selectedFormat) {
      throw new Error("The requested format is no longer available.");
    }
    const stream = await info.download({
      ...(Number.isInteger(itag) && itag > 0
        ? { itag }
        : { type: "video+audio", quality: "best", format: "mp4" }),
    });
    const title = info.basic_info.title || `youtube-${id}`;
    const safeTitle = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim() || `youtube-${id}`;
    const audioOutput = output === "mp3" || output === "wav" || output === "m4a";
    const extension = audioOutput ? output : "mp4";
    const mimeType = output === "mp3" ? "audio/mpeg" : output === "wav" ? "audio/wav" : output === "m4a" ? "audio/mp4" : selectedFormat?.mime_type?.split(';')[0] || "video/mp4";
    const encodedFilename = encodeURIComponent(`${safeTitle}.${extension}`);
    const fallbackFilename = output === "mp3" ? "audio.mp3" : output === "wav" ? "audio.wav" : output === "m4a" ? "audio.m4a" : "video.mp4";
    const downloadCategory = audioOutput ? "audio" : "video";
    const downloadFilename = `${safeTitle}.${extension}`;
    const downloadPath = await ensureDownloadStoragePath(downloadFilename, downloadCategory);

    if (audioOutput) {
      const executable = getFfmpegPath();
      if (!executable) throw new Error("Audio conversion is unavailable on this server.");
      const input = Readable.fromWeb(stream as never);
      const codecArgs = output === "mp3"
        ? ["-codec:a", "libmp3lame", "-b:a", `${bitrate}k`, "-f", "mp3"]
        : output === "wav"
          ? ["-codec:a", "pcm_s16le", "-f", "wav"]
          : ["-codec:a", "aac", "-b:a", "192k", "-f", "ipod"];
      const converter = spawn(executable, ["-loglevel", "error", "-i", "pipe:0", "-vn", ...codecArgs, "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
      converter.once("error", (error) => console.error("FFmpeg audio conversion failed:", error));
      input.pipe(converter.stdin);
      const outputStream = teeStreamToFile(converter.stdout, downloadPath);
      const response = new Response(Readable.toWeb(outputStream as unknown as Readable) as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
          "Access-Control-Expose-Headers": "Content-Disposition",
        },
      });
      return withCors(response, req);
    }

    if (selectedFormat.has_video && !selectedFormat.has_audio) {
      const executable = getFfmpegPath();
      if (!executable) throw new Error("Video merging is unavailable on this server.");
      const audioSource = availableFormats
        .filter((format) => format.has_audio && !format.has_video && !format.has_text)
        .sort((left, right) => right.bitrate - left.bitrate)[0];
      if (!audioSource) throw new Error("An audio stream is unavailable for this video.");

      const audioStream = await info.download({ itag: audioSource.itag });
      const videoInput = Readable.fromWeb(stream as never);
      const audioInput = Readable.fromWeb(audioStream as never);
      const merger = spawn(executable, [
        "-loglevel", "error", "-i", "pipe:3", "-i", "pipe:4",
        "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1",
      ], { stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"] });
      merger.once("error", (error) => console.error("FFmpeg video merge failed:", error));
      videoInput.pipe(merger.stdio[3] as NodeJS.WritableStream);
      audioInput.pipe(merger.stdio[4] as NodeJS.WritableStream);

      const outputStream = teeStreamToFile(merger.stdout!, downloadPath);
      const response = new Response(Readable.toWeb(outputStream as unknown as Readable) as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.mp4`)}`,
          "Access-Control-Expose-Headers": "Content-Disposition",
        },
      });
      return withCors(response, req);
    }

    const outputStream = teeStreamToFile(stream as unknown as Readable, downloadPath);
    const response = new Response(Readable.toWeb(outputStream as unknown as Readable) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
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