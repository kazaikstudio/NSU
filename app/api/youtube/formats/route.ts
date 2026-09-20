import { NextResponse } from 'next/server';
import ffmpegPath from 'ffmpeg-static';
import { getFfmpegDiagnostics, getRuntimeDiagnostics } from '@/lib/youtube-download-diagnostics';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getYoutubePythonFormats } from '@/lib/youtube-python';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isVideoId(value: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

function getFfmpegPath() {
  const localPath = join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
  return [process.env.FFMPEG_PATH, localPath, ffmpegPath].find((path): path is string => Boolean(path && existsSync(path)));
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')?.trim() || '';

  if (!isVideoId(id)) {
    return NextResponse.json({ error: 'Invalid YouTube video ID.' }, { status: 400 });
  }

  try {
    const result = await getYoutubePythonFormats(id);

    if (!result.formats.length) {
      return NextResponse.json({
        error: 'This YouTube video is not currently returning playable streams from the server runtime.',
        code: 'NO_STREAMS_AVAILABLE',
        videoId: id,
        title: result.title || `YouTube video ${id}`,
        diagnostics: {
          source: 'python',
          runtime: getRuntimeDiagnostics(),
          ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
          formatCounts: {
            total: 0,
            exposedFormats: 0,
          },
        },
      }, { status: 404 });
    }

    return NextResponse.json({
      videoId: id,
      title: result.title,
      formats: result.formats,
      diagnostics: {
        source: 'python',
        runtime: getRuntimeDiagnostics(),
        ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
        formatCounts: {
          total: result.formats.length,
          exposedFormats: result.formats.length,
        },
      },
    });
  } catch (error) {
    const detail = error instanceof Error && 'detail' in error ? String((error as { detail?: unknown }).detail || '') : '';
    const workerCode = error instanceof Error && 'workerCode' in error ? (error as { workerCode?: unknown }).workerCode : undefined;
    console.error(`YouTube formats route error for ${id}: ${error instanceof Error ? error.message : String(error)}`, {
      videoId: id,
      workerDetail: detail || undefined,
      workerCode,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to fetch YouTube formats.',
        code: 'YOUTUBE_INFO_FAILED',
        detail: detail || undefined,
        workerCode: typeof workerCode === 'number' ? workerCode : undefined,
        videoId: id,
        diagnostics: {
          runtime: getRuntimeDiagnostics(),
          ffmpeg: getFfmpegDiagnostics(getFfmpegPath()),
          errorName: error instanceof Error ? error.name : 'UnknownError',
        },
      },
      { status: 502 },
    );
  }
}