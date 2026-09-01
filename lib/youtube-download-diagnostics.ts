import { existsSync } from 'node:fs';

export type YoutubeDownloadDiagnosticCode =
  | 'INVALID_VIDEO_ID'
  | 'YOUTUBE_INIT_FAILED'
  | 'YOUTUBE_INFO_FAILED'
  | 'FORMAT_NOT_FOUND'
  | 'YOUTUBE_STREAM_FAILED'
  | 'FFMPEG_NOT_FOUND'
  | 'FFMPEG_SPAWN_FAILED'
  | 'FFMPEG_CONVERSION_FAILED'
  | 'FFMPEG_MERGE_FAILED'
  | 'AUDIO_SOURCE_NOT_FOUND'
  | 'DOWNLOAD_STORAGE_FAILED'
  | 'STREAM_RESPONSE_FAILED'
  | 'UNKNOWN_DOWNLOAD_ERROR';

export type YoutubeDownloadDiagnostic = {
  code: YoutubeDownloadDiagnosticCode;
  message: string;
  details?: Record<string, unknown>;
};

export class YoutubeDownloadError extends Error {
  diagnostic: YoutubeDownloadDiagnostic;
  status: number;

  constructor(status: number, diagnostic: YoutubeDownloadDiagnostic) {
    super(diagnostic.message);
    this.name = 'YoutubeDownloadError';
    this.status = status;
    this.diagnostic = diagnostic;
  }
}

export function getRuntimeDiagnostics(extra?: Record<string, unknown>) {
  return {
    nodeEnv: process.env.NODE_ENV || 'unknown',
    railwayPublicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || null,
    railwayStaticUrl: process.env.RAILWAY_STATIC_URL || null,
    ffmpegPathEnv: process.env.FFMPEG_PATH || null,
    cwd: process.cwd(),
    platform: process.platform,
    arch: process.arch,
    ...extra,
  };
}

export function getFfmpegDiagnostics(candidatePath?: string | null) {
  return {
    ffmpegCandidatePath: candidatePath || null,
    ffmpegExists: candidatePath ? existsSync(candidatePath) : false,
  };
}

export function toDiagnosticPayload(error: unknown) {
  if (error instanceof YoutubeDownloadError) {
    return {
      error: error.message,
      code: error.diagnostic.code,
      details: error.diagnostic.details || {},
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: 'UNKNOWN_DOWNLOAD_ERROR',
      details: {
        name: error.name,
      },
    };
  }

  return {
    error: 'Failed to process download stream',
    code: 'UNKNOWN_DOWNLOAD_ERROR',
    details: {},
  };
}
