import { NextResponse } from 'next/server';
import { testBucketAuth } from '@/lib/railway-storage';

export const runtime = 'nodejs';

export async function GET() {
  const result = await testBucketAuth();
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}
