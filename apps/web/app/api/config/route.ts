import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { issuerFile } from '../../../lib/issuer-files';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const inputs = JSON.parse(await readFile(issuerFile('deployment-inputs.json'), 'utf8'));
    return NextResponse.json(inputs, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Issuer setup required' }, { status: 503 }); }
}
