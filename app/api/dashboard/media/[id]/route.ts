import { NextResponse } from 'next/server';
import { buildAudioDownloadName, getAudioDownloadThumbnailUrl } from '@/lib/download';
import { getMediaDownloadCount, incrementMediaPlayCount, recordDownloadRegion } from '@/lib/media-play';

export const runtime = 'nodejs';

async function fetchGoogleDriveFile(id: string, range?: string) {
  const baseUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    ...(range ? { Range: range } : {}),
  };

  const response = await fetch(baseUrl, { headers, redirect: 'follow' });

  const isHtml = (res: Response) =>
    res.status === 200 && res.headers.get('content-type')?.includes('text/html');

  if (!isHtml(response)) return response;

  const bodyText = await response.text();

  const confirmMatch = bodyText.match(
    /(?:https?:\/\/)?(?:drive\.usercontent\.google\.com\/download|drive\.google\.com\/uc\?export=download)[^"'\s]+/i,
  );

  const candidates = [
    confirmMatch?.[0],
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`,
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`,
  ].filter((url): url is string => Boolean(url));

  for (const url of candidates) {
    try {
      const resolved = await fetch(url, { headers, redirect: 'follow' });
      if (!isHtml(resolved)) return resolved;

      const resolvedBody = await resolved.text();
      if (/(virus|download warning|exception in download|scan this file)/i.test(resolvedBody)) {
        return new Response(
          'Google Drive blocked this download because it could not scan the file for viruses.',
          { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        );
      }
    } catch {
      // fall through to the next candidate
    }
  }

  return new Response(
    'Google Drive returned a web page instead of the audio file. The file may be too large or restricted.',
    { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
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

  const contentType = response.headers.get('content-type');
  if (contentType && /text\/html|text\/plain|application\/json/i.test(contentType)) {
    return NextResponse.json({ error: 'Google Drive returned a text page instead of audio' }, { status: 502 });
  }

  const headers = new Headers();
  const contentLength = response.headers.get('content-length');
  const contentRange = response.headers.get('content-range');
  if (contentType) headers.set('Content-Type', contentType);
  if (contentLength) headers.set('Content-Length', contentLength);
  if (contentRange) headers.set('Content-Range', contentRange);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=3600');

  if (updatedDownloadCount !== null) {
    headers.set('X-NSU-Download-Count', String(updatedDownloadCount));
  }

  if (requestedFilename) {
    const safeFilename = requestedFilename.replace(/[\r\n"\\/]/g, '_');
    const extension = safeFilename.split('.').pop()?.toLowerCase();
    const fileName = buildAudioDownloadName(title || safeFilename, artistName, extension);
    headers.set('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    headers.set('X-NSU-Thumbnail-Url', getAudioDownloadThumbnailUrl());
  }

  return new NextResponse(response.body, { status: response.status, headers });
}
