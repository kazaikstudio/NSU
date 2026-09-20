import { NextResponse } from 'next/server';
import { buildDownloadFilename } from '@/lib/download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;

function parseContentRangeTotal(contentRange: string | null) {
  const match = contentRange?.match(/\/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '::1'
    || normalized.endsWith('.localhost')
    || normalized.startsWith('127.')
    || normalized.startsWith('10.')
    || normalized.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    || normalized === '169.254.169.254';
}

function getSafeFilename(url: URL, contentDisposition: string | null, contentType: string) {
  const filenameMatch = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const fromHeader = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : '';
  const fromPath = decodeURIComponent(url.pathname.split('/').pop() || '').trim();
  const fallbackExtension = contentType.split('/')[1]?.split(';')[0] || 'bin';
  return buildDownloadFilename(fromHeader || fromPath || `download.${fallbackExtension}`);
}

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get('url')?.trim() || '';
  let target: URL;

  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Enter a complete download URL.' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(target.protocol) || isPrivateHostname(target.hostname)) {
    return NextResponse.json({ error: 'Only public HTTP and HTTPS media URLs are supported.' }, { status: 400 });
  }

  try {
    const clientRange = request.headers.get('range');
    const upstreamHeaders: Record<string, string> = { Accept: 'audio/*, video/*, application/octet-stream;q=0.9, */*;q=0.1' };
    if (clientRange) upstreamHeaders['Range'] = clientRange;

    const response = await fetch(target, {
      cache: 'no-store',
      redirect: 'follow',
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `The source returned HTTP ${response.status}.` }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = Number(response.headers.get('content-length') || 0);
    const totalLength = parseContentRangeTotal(response.headers.get('content-range')) || contentLength;
    if (totalLength > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: 'This file is larger than the 2 GB download limit.' }, { status: 413 });
    }
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      return NextResponse.json({ error: 'That URL is a webpage, not a direct media file.' }, { status: 415 });
    }

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${getSafeFilename(target, response.headers.get('content-disposition'), contentType)}"`,
      'X-NSU-Filename': getSafeFilename(target, response.headers.get('content-disposition'), contentType),
      'Cache-Control': 'no-store',
      'X-NSU-Download-Code': 'direct-url',
    });
    if (contentLength > 0) headers.set('Content-Length', String(contentLength));
    const contentRange = response.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    if (clientRange) headers.set('X-NSU-Resume-Supported', response.status === 206 ? 'true' : 'false');

    return new Response(response.body, { status: response.status === 206 ? 206 : 200, headers });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? 'The source took too long to respond.'
      : 'Unable to reach that download URL.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}