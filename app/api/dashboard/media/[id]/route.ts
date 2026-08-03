import { NextResponse } from 'next/server';
import pool, { ensureDatabaseReady } from '@/lib/db';

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
      await ensureDatabaseReady();
      await pool.query(
        `UPDATE artist_media
         SET download_count = COALESCE(download_count, 0) + 1
         WHERE drive_file_id = $1 AND kind = 'track'`,
        [id]
      );
      await pool.query(
        `UPDATE artists
         SET total_downloads = COALESCE(total_downloads, 0) + 1
         WHERE id::text = (SELECT artist_id FROM artist_media WHERE drive_file_id = $1 LIMIT 1)`,
        [id]
      );
    } catch (error) {
      console.error('Unable to record artist download:', error);
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
    headers.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
  }

  return new NextResponse(response.body, { status: response.status, headers });
}
