import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { liveConfig, livePrivateRoot } from '../../../lib/live-config';
import { createVeilPassVerifier, VeilPassError } from '../../../../../packages/sdk';
import { FileChallengeStore } from '../../../../../packages/sdk/file-store';
import { MidnightChainAdapter } from '../../../../../packages/sdk/midnight-adapter';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const rateGlobal = globalThis as typeof globalThis & { veilpassLiveRate?: { start:number; count:number } };
const headers = { 'Cache-Control': 'no-store' };
export async function GET() {
  try { return NextResponse.json(await liveConfig(), { headers }); }
  catch { return NextResponse.json({ error:'Live V2 deployment is not configured. See the live setup guide.' }, { status:503, headers }); }
}
export async function POST(request: NextRequest) {
  let origin: URL;
  try { origin = new URL(request.headers.get('origin') || ''); } catch { return NextResponse.json({error:'Origin required'}, {status:403,headers}); }
  if (origin.host !== request.headers.get('host') || !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) return NextResponse.json({error:'Live developer preview requires same-origin loopback access'}, {status:403,headers});
  const rate = rateGlobal.veilpassLiveRate ??= { start:Date.now(),count:0 };
  if(Date.now()-rate.start>60000){rate.start=Date.now();rate.count=0;}
  if(++rate.count>60)return NextResponse.json({error:'Too many live requests; retry in one minute'},{status:429,headers});
  try {
    const reader = request.body?.getReader(); if (!reader) throw new Error('Body required');
    const chunks: Uint8Array[] = []; let size=0;
    while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>2048) {await reader.cancel(); return NextResponse.json({error:'Request too large'},{status:413,headers});} chunks.push(value); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || !['approved-training','professional-level'].includes(body.policy) || !['challenge','verify'].includes(body.action)) return NextResponse.json({error:'Unsupported verifier request'},{status:400,headers});
    const config = await liveConfig();
    const keyDirectory=path.resolve(livePrivateRoot(),'..','contracts/lifecycle/managed/keys');
    const verifierKeys={authorize:await readFile(path.join(keyDirectory,'authorize.verifier')),revoke:await readFile(path.join(keyDirectory,'revoke.verifier')),deactivateIssuer:await readFile(path.join(keyDirectory,'deactivateIssuer.verifier'))};
    const verifier = createVeilPassVerifier({ audience: body.policy === 'approved-training' ? config.appA : config.appB, networkDomain:config.domain, contractAddress:config.contractAddress, policyId:body.policy, store:new FileChallengeStore(path.resolve(livePrivateRoot(),'live-challenges',config.network,config.contractAddress,body.policy)), chain:new MidnightChainAdapter({indexerUrl:config.indexerUri,contractAddress:config.contractAddress,networkDomain:config.domain,root:config.root,verifierKeys}) });
    const result = body.action === 'challenge' ? await verifier.createChallenge(300) : await verifier.verifyPresentation(body.presentation);
    return NextResponse.json({result},{headers});
  } catch(error) {
    return NextResponse.json({error:error instanceof VeilPassError ? error.message : 'Live verifier unavailable. Check the configured deployment and indexer.',code:error instanceof VeilPassError ? error.code : 'UNAVAILABLE'},{status:400,headers});
  }
}
