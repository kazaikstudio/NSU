import { NextResponse } from 'next/server';
import { buildDownloadFilename, getAudioDownloadThumbnailUrl } from '@/lib/download';
import { incrementMediaPlayCount } from '@/lib/media-play';

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

  if (searchParams.get('download') === '1') {
    try {
      await incrementMediaPlayCount(id);
    } catch (error) {
      console.error('Unable to record artist download:', error);
    }
  }

  if (searchParams.get('play') === '1') {
    try {
      const trackDownloads = await incrementMediaPlayCount(id);
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
    const fileName = buildDownloadFilename(safeFilename, 'audio');
    headers.set('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    headers.set('X-NSU-Thumbnail-Url', getAudioDownloadThumbnailUrl());
  }

  return new NextResponse(response.body, { status: response.status, headers });
}
