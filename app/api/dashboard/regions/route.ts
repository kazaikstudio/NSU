import { NextResponse } from 'next/server';
import { getDownloadRegions } from '@/lib/media-play';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ regions: await getDownloadRegions() });
  } catch (error) {
    console.error('Unable to load download regions:', error);
    return NextResponse.json({ error: 'Unable to load download regions', regions: [] }, { status: 500 });
  }
}
