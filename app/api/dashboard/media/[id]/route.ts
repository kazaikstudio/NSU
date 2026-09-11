import { NextResponse } from 'next/server';
import ffmpegPath from 'ffmpeg-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { buildDownloadFilename, getAudioDownloadThumbnailUrl } from '@/lib/download';
import { getMediaDownloadCount, incrementMediaPlayCount, recordDownloadRegion } from '@/lib/media-play';

export const runtime = 'nodejs';

async function fetchGoogleDriveFile(id: string, range?: string) {
  const baseUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    ...(range ? { Range: range } : {}),
  };

  const response = await fetch(baseUrl, { headers, redirect: 'follow' });

  if (response.status === 200 && response.headers.get('content-type')?.includes('text/html')) {
    const bodyText = await response.text();
    const confirmMatch = bodyText.match(/https?:\/\/drive\.google\.com\/uc\?export=download[^"'\s]+/i);
    const fallbackUrl = confirmMatch?.[0] ?? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`;
    const fallbackResponse = await fetch(fallbackUrl, { headers, redirect: 'follow' });

    if (fallbackResponse.status === 200 && fallbackResponse.headers.get('content-type')?.includes('text/html')) {
      const fallbackBody = await fallbackResponse.text();
      if (fallbackBody.includes('virus') || fallbackBody.includes('download warning')) {
        return new Response(fallbackBody, {
          status: 502,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }

    return fallbackResponse;
  }

  return response;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid media file id' }, { status: 400 });
  }

  const range = request.headers.get('range');
  const searchParams = new URL(request.url).searchParams;
  const requestedFilename = searchParams.get('filename');
  const artistName = searchParams.get('artist') || undefined;
  const title = searchParams.get('title') || undefined;
  const downloadRegion = searchParams.get('region');
  let updatedDownloadCount: number | null = null;

  if (searchParams.get('download') === '1') {
    try {
      updatedDownloadCount = await incrementMediaPlayCount(id);
      if (downloadRegion) {
        await recordDownloadRegion(downloadRegion);
      }
    } catch (error) {
      console.error('Unable to record artist download:', error);
    }
  }

  if (searchParams.get('play') === '1') {
    try {
      const trackDownloads = await getMediaDownloadCount(id);
      return NextResponse.json({ trackDownloads });
    } catch (error) {
      console.error('Unable to record artist play:', error);
    }
  }
  const response = await fetchGoogleDriveFile(id, range ?? undefined);

  if (!response.ok && response.status !== 206) {
    return NextResponse.json({ error: 'Unable to load audio from Google Drive' }, { status: response.status });
  }

  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  const contentLength = response.headers.get('content-length');
  const contentRange = response.headers.get('content-range');
  if (contentType) headers.set('Content-Type', contentType);
  if (contentLength) headers.set('Content-Length', contentLength);
  if (contentRange) headers.set('Content-Range', contentRange);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=3600');

  if (requestedFilename) {
    const safeFilename = requestedFilename.replace(/[\r\n"\\/]/g, '_');
    const fileName = buildDownloadFilename(safeFilename, 'audio', artistName);
    headers.set('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    headers.set('X-NSU-Thumbnail-Url', getAudioDownloadThumbnailUrl());

    const artworkPath = join(process.cwd(), 'public', 'noll.jpg');
    const extension = safeFilename.split('.').pop()?.toLowerCase();
    if (searchParams.get('download') === '1' && existsSync(artworkPath) && (extension === 'mp3' || extension === 'm4a')) {
      if (!ffmpegPath) {
        return NextResponse.json({ error: 'Audio artwork processing is unavailable on this server' }, { status: 503 });
      }

      const source = Readable.fromWeb(response.body as never);
      const outputFormat = extension === 'mp3' ? 'mp3' : 'ipod';
      const converter = spawn(ffmpegPath, [
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-i', artworkPath,
        '-map', '0:a',
        '-map', '1:v',
        '-c:a', 'copy',
        '-c:v', 'mjpeg',
        '-disposition:v', 'attached_pic',
        ...(title ? ['-metadata', `title=${title}`] : []),
        ...(artistName ? ['-metadata', `artist=${artistName}`] : []),
        '-f', outputFormat,
        'pipe:1',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      converter.stderr.on('data', (chunk: Buffer) => console.error('Audio artwork processing failed:', chunk.toString()));
      source.pipe(converter.stdin);

      headers.delete('Content-Length');
      headers.set('Content-Type', extension === 'mp3' ? 'audio/mpeg' : 'audio/mp4');
      return new NextResponse(Readable.toWeb(converter.stdout) as ReadableStream, { status: 200, headers });
    }
  }
  if (updatedDownloadCount !== null) {
    headers.set('X-NSU-Download-Count', String(updatedDownloadCount));
  }

  return new NextResponse(response.body, { status: response.status, headers });
}
