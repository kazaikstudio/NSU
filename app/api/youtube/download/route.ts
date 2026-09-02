import { NextResponse } from "next/server";
import { ClientType, Innertube } from "youtubei.js";
import ffmpegPath from "ffmpeg-static";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import {
  ensureDownloadStoragePath,
  getDownloadStorageDiagnostics,
  teeStreamToFile,
} from "@/lib/download-storage";
import { buildDownloadFilename, getAudioDownloadThumbnailUrl } from '@/lib/download';
import { resolveAllowedOrigin } from '@/lib/request-origin';
import {
  YoutubeDownloadError,
  getFfmpegDiagnostics,
  getRuntimeDiagnostics,
  toDiagnosticPayload,
} from '@/lib/youtube-download-diagnostics';

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const YOUTUBE_CLIENT_TYPES = [ClientType.ANDROID_VR, ClientType.WEB, ClientType.IOS] as const;

async function getYoutubeVideoInfo(videoId: string) {
  let lastError: unknown;

  for (const clientType of YOUTUBE_CLIENT_TYPES) {
    try {
      const youtube = await Innertube.create({ client_type: clientType, retrieve_player: true });
      const info = await youtube.getBasicInfo(videoId);
      const formatCount = (info.streaming_data?.formats?.length ?? 0) + (info.streaming_data?.adaptive_formats?.length ?? 0);
      const hasTitle = Boolean(info.basic_info?.title);

      if (formatCount > 0 || hasTitle) {
        return { youtube, info, clientType };
      }

      lastError = new Error(`No playable stream metadata for ${videoId} using ${String(clientType)}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`Unable to fetch YouTube metadata for ${videoId}`);
}

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
  response.headers.set('X-NSU-Download-Runtime', process.env.RAILWAY_PUBLIC_DOMAIN ? 'railway' : 'nodejs');
  return response;
}

async function createStoredDownloadPath(filename: string, category: "audio" | "video") {
  try {
    return await ensureDownloadStoragePath(filename, category);
  } catch (error) {
    throw new YoutubeDownloadError(500, {
      code: 'DOWNLOAD_STORAGE_FAILED',
      message: 'Download storage is unavailable on this server.',
      details: {
        storage: getDownloadStorageDiagnostics(category),
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function createReadableStreamResponse(stream: Readable, init: ResponseInit, diagnosticCode: string) {
  try {
    const response = new Response(Readable.toWeb(stream as unknown as Readable) as unknown as BodyInit, init);
    return setDiagnosticHeaders(response, diagnosticCode);
  } catch (error) {
    throw new YoutubeDownloadError(500, {
      code: 'STREAM_RESPONSE_FAILED',
      message: 'The server could not stream the download response.',
      details: {
        diagnosticCode,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function collectProcessStderr(proc: NodeJS.ReadableStream | null | undefined, sink: string[]) {
  if (!proc) return;
  proc.on('data', (chunk) => {
    sink.push(chunk.toString());
  });
}

function registerProcessFailureHandlers(
  processName: 'ffmpeg-convert' | 'ffmpeg-merge',
  child: ReturnType<typeof spawn>,
  stderrBuffer: string[],
  context: Record<string, unknown>,
) {
  child.once('error', (error) => {
    console.error(`${processName} spawn failed`, error, context);
  });

  child.once('close', (code, signal) => {
    if (code && code !== 0) {
      console.error(`${processName} exited with non-zero status`, {
        ...context,
        code,
        signal,
        stderr: stderrBuffer.join('').trim().slice(0, 4000),
      });
    }
  });
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
      NextResponse.json({ error: "Missing video 'id' parameter", code: 'INVALID_VIDEO_ID' }, { status: 400 }),
      req
    );
  }

  try {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      throw new YoutubeDownloadError(400, {
        code: 'INVALID_VIDEO_ID',
        message: 'Invalid YouTube Video ID',
        details: getRequestDiagnostics(id, itag, output),
      });
    }

    let info: Awaited<ReturnType<Innertube['getBasicInfo']>>;
    try {
      ({ info } = await getYoutubeVideoInfo(id));
    } catch (error) {
      throw new YoutubeDownloadError(502, {
        code: 'YOUTUBE_INFO_FAILED',
        message: 'Unable to fetch YouTube video details from the server runtime.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          cause: error instanceof Error ? error.message : String(error),
          clientFallbacks: YOUTUBE_CLIENT_TYPES,
        },
      });
    }

    const availableFormats = [
      ...(info.streaming_data?.formats || []),
      ...(info.streaming_data?.adaptive_formats || []),
    ];

    if (availableFormats.length === 0) {
      throw new YoutubeDownloadError(404, {
        code: 'NO_STREAMS_AVAILABLE',
        message: 'This YouTube video is not currently returning playable streams from the server runtime.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          clientFallbacks: YOUTUBE_CLIENT_TYPES,
          title: info.basic_info?.title || `YouTube video ${id}`,
        },
      });
    }

    const selectedFormat = availableFormats.find((format) => format.itag === itag);
    const ffmpegAvailable = Boolean(getFfmpegPath());

    if (!selectedFormat) {
      throw new YoutubeDownloadError(404, {
        code: 'FORMAT_NOT_FOUND',
        message: 'The requested format is no longer available.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          availableItags: availableFormats.map((format) => format.itag),
        },
      });
    }

    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await info.download({
        ...(Number.isInteger(itag) && itag > 0
          ? { itag }
          : { type: "video+audio", quality: "best", format: "mp4" }),
      });
    } catch (error) {
      throw new YoutubeDownloadError(502, {
        code: 'YOUTUBE_STREAM_FAILED',
        message: 'The YouTube media stream could not be opened on this server.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          cause: error instanceof Error ? error.message : String(error),
          selectedFormat: {
            itag: selectedFormat.itag,
            mimeType: selectedFormat.mime_type,
            hasAudio: selectedFormat.has_audio,
            hasVideo: selectedFormat.has_video,
            bitrate: selectedFormat.bitrate,
          },
        },
      });
    }

    const title = info.basic_info.title || `youtube-${id}`;
    const safeTitle = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim() || `youtube-${id}`;
    const audioOutput = output === "mp3" || output === "wav" || output === "m4a";
    const extension = audioOutput ? output : "mp4";
    const mimeType = output === "mp3"
      ? "audio/mpeg"
      : output === "wav"
        ? "audio/wav"
        : output === "m4a"
          ? "audio/mp4"
          : selectedFormat?.mime_type?.split(';')[0] || "video/mp4";
    const downloadCategory = audioOutput ? "audio" : "video";
    const downloadDisplayName = buildDownloadFilename(`${safeTitle}.${extension}`, downloadCategory);
    const encodedFilename = encodeURIComponent(downloadDisplayName);
    const fallbackFilename = downloadDisplayName;
    const downloadFilename = downloadDisplayName;
    const downloadPath = await createStoredDownloadPath(downloadFilename, downloadCategory);

    if (audioOutput && !ffmpegAvailable) {
      throw new YoutubeDownloadError(503, {
        code: 'FFMPEG_NOT_FOUND',
        message: 'Audio downloads are temporarily unavailable on this server.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
        },
      });
    }

    if (!audioOutput && !selectedFormat.has_audio && !ffmpegAvailable) {
      throw new YoutubeDownloadError(503, {
        code: 'FFMPEG_NOT_FOUND',
        message: 'This video quality requires server-side merging, which is unavailable on this server. Please choose a standard MP4 option.',
        details: {
          ...getRequestDiagnostics(id, itag, output),
          selectedFormat: {
            itag: selectedFormat.itag,
            mimeType: selectedFormat.mime_type,
            hasAudio: selectedFormat.has_audio,
            hasVideo: selectedFormat.has_video,
            bitrate: selectedFormat.bitrate,
          },
        },
      });
    }

    if (audioOutput) {
      const executable = getFfmpegPath();
      if (!executable) {
        throw new YoutubeDownloadError(503, {
          code: 'FFMPEG_NOT_FOUND',
          message: 'Audio conversion is unavailable on this server.',
          details: {
            ...getRequestDiagnostics(id, itag, output),
            ffmpeg: getFfmpegDiagnostics(executable),
          },
        });
      }

      const input = Readable.fromWeb(stream as never);
      const artworkPath = join(process.cwd(), "public", "noll.jpg");
      const artworkAvailable = existsSync(artworkPath);
      const codecArgs = output === "mp3"
        ? ["-codec:a", "libmp3lame", "-b:a", `${bitrate}k`, "-f", "mp3"]
        : output === "wav"
          ? ["-codec:a", "pcm_s16le", "-f", "wav"]
          : ["-codec:a", "aac", "-b:a", "192k", "-f", "ipod"];
      const ffmpegArgs = artworkAvailable
        ? ["-loglevel", "error", "-i", "pipe:0", "-i", artworkPath, "-map", "0:a", "-map", "1:v", "-c:a", ...codecArgs.slice(1, 3), "-c:v", "mjpeg", "-disposition:v", "attached_pic", "-f", "mp3", "pipe:1"]
        : ["-loglevel", "error", "-i", "pipe:0", "-vn", ...codecArgs, "pipe:1"];
      const converter = spawn(executable, ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"] });
      const stderrBuffer: string[] = [];
      collectProcessStderr(converter.stderr, stderrBuffer);
      registerProcessFailureHandlers('ffmpeg-convert', converter, stderrBuffer, {
        videoId: id,
        itag,
        output,
        ffmpegPath: executable,
      });
      input.pipe(converter.stdin);
      const outputStream = teeStreamToFile(converter.stdout, downloadPath);
      outputStream.once('error', (error) => {
        console.error('audio stream pipeline failed', {
          videoId: id,
          itag,
          output,
          ffmpegPath: executable,
          stderr: stderrBuffer.join('').trim().slice(0, 4000),
          cause: error instanceof Error ? error.message : String(error),
        });
      });
      const response = createReadableStreamResponse(outputStream, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
          "X-NSU-Thumbnail-Url": getAudioDownloadThumbnailUrl(),
          "Access-Control-Expose-Headers": "Content-Disposition, X-NSU-Download-Code, X-NSU-Download-Runtime, X-NSU-Thumbnail-Url",
          "Cache-Control": 'no-store',
        },
      }, 'audio-convert');
      return withCors(response, req);
    }

    if (selectedFormat.has_video && !selectedFormat.has_audio) {
      const executable = getFfmpegPath();
      if (!executable) {
        throw new YoutubeDownloadError(503, {
          code: 'FFMPEG_NOT_FOUND',
          message: 'Video merging is unavailable on this server.',
          details: {
            ...getRequestDiagnostics(id, itag, output),
            ffmpeg: getFfmpegDiagnostics(executable),
          },
        });
      }

      const audioSource = availableFormats
        .filter((format) => format.has_audio && !format.has_video && !format.has_text)
        .sort((left, right) => right.bitrate - left.bitrate)[0];
      if (!audioSource) {
        throw new YoutubeDownloadError(404, {
          code: 'AUDIO_SOURCE_NOT_FOUND',
          message: 'An audio stream is unavailable for this video.',
          details: {
            ...getRequestDiagnostics(id, itag, output),
            selectedFormatItag: selectedFormat.itag,
          },
        });
      }

      let audioStream: ReadableStream<Uint8Array>;
      try {
        audioStream = await info.download({ itag: audioSource.itag });
      } catch (error) {
        throw new YoutubeDownloadError(502, {
          code: 'YOUTUBE_STREAM_FAILED',
          message: 'The companion audio stream could not be opened on this server.',
          details: {
            ...getRequestDiagnostics(id, itag, output),
            audioItag: audioSource.itag,
            cause: error instanceof Error ? error.message : String(error),
          },
        });
      }

      const videoInput = Readable.fromWeb(stream as never);
      const audioInput = Readable.fromWeb(audioStream as never);
      const merger = spawn(executable, [
        "-loglevel", "error", "-i", "pipe:3", "-i", "pipe:4",
        "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-movflags", "frag_keyframe+empty_moov", "-f", "mp4", "pipe:1",
      ], { stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"] });
      const stderrBuffer: string[] = [];
      collectProcessStderr(merger.stderr, stderrBuffer);
      registerProcessFailureHandlers('ffmpeg-merge', merger, stderrBuffer, {
        videoId: id,
        itag,
        output,
        audioItag: audioSource.itag,
        ffmpegPath: executable,
      });
      videoInput.pipe(merger.stdio[3] as NodeJS.WritableStream);
      audioInput.pipe(merger.stdio[4] as NodeJS.WritableStream);

      const outputStream = teeStreamToFile(merger.stdout!, downloadPath);
      outputStream.once('error', (error) => {
        console.error('video merge pipeline failed', {
          videoId: id,
          itag,
          output,
          audioItag: audioSource.itag,
          ffmpegPath: executable,
          stderr: stderrBuffer.join('').trim().slice(0, 4000),
          cause: error instanceof Error ? error.message : String(error),
        });
      });
      const response = createReadableStreamResponse(outputStream, {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(`${safeTitle}.mp4`)}`,
          "Access-Control-Expose-Headers": "Content-Disposition, X-NSU-Download-Code, X-NSU-Download-Runtime",
          "Cache-Control": 'no-store',
        },
      }, 'video-merge');
      return withCors(response, req);
    }

    const outputStream = teeStreamToFile(Readable.fromWeb(stream as never), downloadPath);
    outputStream.once('error', (error) => {
      console.error('direct stream pipeline failed', {
        videoId: id,
        itag,
        output,
        cause: error instanceof Error ? error.message : String(error),
      });
    });
    const response = createReadableStreamResponse(outputStream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Access-Control-Expose-Headers": "Content-Disposition, X-NSU-Download-Code, X-NSU-Download-Runtime",
        "Cache-Control": 'no-store',
      },
    }, 'direct-stream');

    return withCors(response, req);
  } catch (error: unknown) {
    const payload = toDiagnosticPayload(error);
    const status = error instanceof YoutubeDownloadError ? error.status : 500;
    console.error("Download route error:", {
      status,
      ...payload,
    });
    const response = NextResponse.json(payload, { status });
    setDiagnosticHeaders(response, payload.code || 'UNKNOWN_DOWNLOAD_ERROR');
    return withCors(response, req);
  }
}
