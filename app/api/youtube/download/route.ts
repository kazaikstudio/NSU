import { NextResponse } from "next/server";
import ffmpegPath from "ffmpeg-static";
import { existsSync } from "node:fs";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, rename, rm, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ensureDownloadStoragePath } from "@/lib/download-storage";
import { buildDownloadFilename, getAudioDownloadThumbnailUrl } from "@/lib/download";
import { resolveAllowedOrigin } from "@/lib/request-origin";
import { downloadWithPython } from "@/lib/youtube-python";
import {
  YoutubeDownloadError,
  getFfmpegDiagnostics,
  getRuntimeDiagnostics,
  toDiagnosticPayload,
} from "@/lib/youtube-download-diagnostics";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const AUDIO_OUTPUTS = new Set(["mp3", "wav", "m4a", "aac"]);

function getFfmpegPath() {
  const localPath = join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
  return [process.env.FFMPEG_PATH, localPath, ffmpegPath].find((path): path is string => Boolean(path && existsSync(path)));
}

function withCors(response: NextResponse | Response, request: Request) {
  const origin = request.headers.get("origin");
  const allowOrigin = resolveAllowedOrigin(origin);

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

function getRequestDiagnostics(id: string, itag: number, output: string) {
  return getRuntimeDiagnostics({
    videoId: id,
    itag,
    output,
  });
}

function setDiagnosticHeaders(response: Response, diagnosticCode: string) {
  response.headers.set('X-NSU-Download-Code', diagnosticCode);
  response.headers.set('X-NSU-Download-Runtime', process.env.RAILWAY_PUBLIC_DOMAIN ? 'railway-python' : 'python');
  return response;
}

function createCancelSafeWebStream(streamPath: string): ReadableStream<Uint8Array> {
  const source = createReadStream(streamPath);
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      source.on("data", (chunk) => {
        if (cancelled) return;
        try {
          controller.enqueue(chunk as Uint8Array);
        } catch {
          cancelled = true;
          source.destroy();
          return;
        }
        if (controller.desiredSize != null && controller.desiredSize <= 0) {
          source.pause();
        }
      });
      source.on("end", () => {
        if (cancelled) return;
        try {
          controller.close();
        } catch {
          cancelled = true;
        }
      });
      source.on("error", (error) => {
        console.error("download stream pipeline failed", {
          path: streamPath,
          cause: error instanceof Error ? error.message : String(error),
        });
        if (cancelled) return;
        try {
          controller.error(error);
        } catch {
          cancelled = true;
        }
      });
    },
    pull() {
      if (!cancelled && source.isPaused()) source.resume();
    },
    cancel() {
      cancelled = true;
      source.destroy();
    },
  });
}

function createStreamingResponse(streamPath: string, size: number, init: ResponseInit, diagnosticCode: string) {
  const body = createCancelSafeWebStream(streamPath);
  const response = new Response(body as unknown as BodyInit, init);
  return setDiagnosticHeaders(response, diagnosticCode);
}

function getOutputMimeType(output: string, videoMimeType: string) {
  if (output === "mp3") return "audio/mpeg";
  if (output === "wav") return "audio/wav";
  if (output === "aac") return "audio/mp4";
  if (output === "m4a") return "audio/mp4";
  return videoMimeType;
}

function moveIntoStorage(source: string, targetPath: string) {
  return rename(source, targetPath).catch((error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      return copyFile(source, targetPath).then(() => unlink(source));
    }
    throw error;
  });
}

async function createStoredDownloadPath(filename: string, category: "audio" | "video") {
  try {
    return await ensureDownloadStoragePath(filename, category);
  } catch (error) {
    throw new YoutubeDownloadError(500, {
      code: 'DOWNLOAD_STORAGE_FAILED',
      message: 'Download storage is unavailable on this server.',
      details: {
        category,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const id = searchParams.get("id") || searchParams.get("videoId");
  const itag = Number(searchParams.get("itag"));
  const rawOutput = (searchParams.get("output") || "mp4").toLowerCase();
  const output = rawOutput;
  const bitrate = Number(searchParams.get("bitrate")) || 192;

  if (!id) {
    return withCors(
      NextResponse.json({ error: "Missing video 'id' parameter", code: 'INVALID_VIDEO_ID' }, { status: 400 }),
      req
    );
  }

  let scratchDir = "";
  try {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      throw new YoutubeDownloadError(400, {
        code: 'INVALID_VIDEO_ID',
        message: 'Invalid YouTube Video ID',
        details: getRequestDiagnostics(id, itag, output),
      });
    }

    if (output !== "mp4" && !AUDIO_OUTPUTS.has(output)) {
      throw new YoutubeDownloadError(400, {
        code: 'INVALID_VIDEO_ID',
        message: 'Unsupported download output format.',
        details: getRequestDiagnostics(id, itag, output),
      });
    }

    const audioOutput = AUDIO_OUTPUTS.has(output);
    const extension = audioOutput ? output : "mp4";
    const category = audioOutput ? "audio" as const : "video" as const;

    const executable = getFfmpegPath();
    if (audioOutput && !executable) {
      throw new YoutubeDownloadError(503, {
        code: 'FFMPEG_NOT_FOUND',
        message: 'Audio downloads are temporarily unavailable on this server.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          ffmpeg: getFfmpegDiagnostics(executable),
        },
      });
    }

    const scratchRoot = join(process.cwd(), "downloads", ".tmp");
    await mkdir(scratchRoot, { recursive: true });
    scratchDir = await mkdtemp(join(scratchRoot, "ydl-"));

    let workerResult;
    try {
      workerResult = await downloadWithPython({
        videoId: id,
        itag,
        output,
        bitrate,
        outPrefix: join(scratchDir, "download"),
        ffmpegLocation: executable || null,
      });
    } catch (workerError) {
      throw new YoutubeDownloadError(502, {
        code: 'YOUTUBE_STREAM_FAILED',
        message: workerError instanceof Error ? workerError.message : 'The Python download worker failed to produce the requested media.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          cause: workerError instanceof Error ? workerError.message : String(workerError),
          workerDetail: (workerError as Error & { detail?: string }).detail || undefined,
          ffmpeg: getFfmpegDiagnostics(executable),
        },
      });
    }

    const safeTitle = workerResult.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim() || `youtube-${id}`;
    const downloadDisplayName = buildDownloadFilename(`${safeTitle}.${extension}`, category);
    const storedPath = await createStoredDownloadPath(downloadDisplayName, category);

    try {
      await moveIntoStorage(workerResult.file, storedPath);
    } catch (moveError) {
      throw new YoutubeDownloadError(500, {
        code: 'DOWNLOAD_STORAGE_FAILED',
        message: 'The downloaded media could not be stored on this server.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          cause: moveError instanceof Error ? moveError.message : String(moveError),
        },
      });
    }

    const storedFile = await stat(storedPath);
    const mimeType = getOutputMimeType(output, workerResult.contentType);
    const fallbackFilename = downloadDisplayName;
    const encodedFilename = encodeURIComponent(downloadDisplayName);
    const thumbnailUrl = searchParams.get('thumbnailUrl') || searchParams.get('thumbnail');

    const response = createStreamingResponse(storedPath, storedFile.size, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(storedFile.size),
        "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
        "X-NSU-Thumbnail-Url": getAudioDownloadThumbnailUrl(thumbnailUrl),
        "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, X-NSU-Download-Code, X-NSU-Download-Runtime, X-NSU-Thumbnail-Url",
        "Cache-Control": 'no-store',
      },
    }, 'python-stream');

    return withCors(response, req);
  } catch (error: unknown) {
    const payload = toDiagnosticPayload(error);
    const status = error instanceof YoutubeDownloadError ? error.status : 500;
    const errorText = typeof payload.error === 'string' ? payload.error : 'Unknown download error';
    console.error(`Download route error [${payload.code}]: ${errorText}`, {
      status,
      ...payload,
    });
    const response = NextResponse.json(payload, { status });
    setDiagnosticHeaders(response, payload.code || 'UNKNOWN_DOWNLOAD_ERROR');
    return withCors(response, req);
  } finally {
    if (scratchDir) {
      await rm(scratchDir, { recursive: true, force: true }).catch((error) => {
        console.error('failed to clean up python download scratch directory', {
          scratchDir,
          cause: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }
}