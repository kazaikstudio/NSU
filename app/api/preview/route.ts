import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get('url')?.trim() || '';

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'Enter a complete preview URL.' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(target.protocol) || isPrivateHostname(target.hostname)) {
    return NextResponse.json({ error: 'Only public HTTP and HTTPS URLs are supported.' }, { status: 400 });
  }

  try {
    const probe = await fetch(target, {
      cache: 'no-store',
      redirect: 'follow',
      method: 'HEAD',
      headers: { Accept: 'image/*, audio/*, video/*, application/pdf, */*' },
      signal: AbortSignal.timeout(15_000),
    });

    const effectiveUrl = probe.url || target.toString();
    const contentType = probe.headers.get('content-type') || '';
    const contentLength = probe.headers.get('content-length');
    const status = probe.status;

    if (status === 405 || status === 501) {
      const rangeProbe = await fetch(target, {
        cache: 'no-store',
        redirect: 'follow',
        method: 'GET',
        headers: { Accept: 'image/*, audio/*, video/*, application/pdf, */*', Range: 'bytes=0-0' },
        signal: AbortSignal.timeout(15_000),
      });
      return NextResponse.json({
        effectiveUrl: rangeProbe.url || target.toString(),
        contentType: rangeProbe.headers.get('content-type') || '',
        contentLength: rangeProbe.headers.get('content-length'),
        status: rangeProbe.status,
      });
    }

    return NextResponse.json({ effectiveUrl, contentType, contentLength, status });
  } catch {
    return NextResponse.json({ error: 'Unable to probe that URL.' }, { status: 502 });
  }
}