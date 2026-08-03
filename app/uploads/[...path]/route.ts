import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  const { path: routeParts } = await context.params;
  const requestedPath = routeParts?.join('/') || '';

  if (!requestedPath) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  const fullPath = path.join(process.cwd(), 'uploads', requestedPath);
  const normalizedPath = path.normalize(fullPath);
  const uploadsDir = path.normalize(path.join(process.cwd(), 'uploads'));

  if (!normalizedPath.startsWith(uploadsDir)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  try {
    const fileBuffer = await fs.readFile(normalizedPath);
    const extension = path.extname(normalizedPath).toLowerCase();
    const contentTypeByExtension: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.m4a': 'audio/mp4',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain; charset=utf-8',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
    };

    const headers = new Headers();
    headers.set('Content-Type', contentTypeByExtension[extension] || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(fileBuffer, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
