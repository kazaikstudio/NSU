import { NextResponse } from 'next/server';
import { testDriveAuth } from '@/lib/google-drive';

export const runtime = 'nodejs';

export async function GET() {
  const result = await testDriveAuth();
  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}
