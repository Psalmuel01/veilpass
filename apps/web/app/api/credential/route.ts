import { readFile } from 'node:fs/promises';
import { issuerFile } from '../../../lib/issuer-files';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  // Demo-only issuer: same two sample credentials, never a production identity API.
  let sameOrigin = false;
  try { sameOrigin = new URL(request.headers.get('origin') || '').host === request.headers.get('host'); } catch {}
  if (!sameOrigin) return NextResponse.json({ error: 'Origin rejected' }, { status: 403 });
  try {
    const body = await request.json();
    if (body.scenario !== 'valid' && body.scenario !== 'invalid') return NextResponse.json({ error: 'Invalid demo case' }, { status: 400 });
    const batch = JSON.parse(await readFile(issuerFile('issuer-batch.json'), 'utf8'));
    return NextResponse.json(batch[body.scenario], { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Demo issuer unavailable. Run npm run issuer:setup in the project root.' }, { status: 503 }); }
}
