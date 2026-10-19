import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { Workbench } from '../../../../../packages/lifecycle/workbench';
import { FileChallengeStore } from '../../../../../packages/sdk/file-store';
import { VeilPassError, type PolicyId } from '../../../../../packages/sdk';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Session = { engine: Workbench; expires: number; calls: number; window: number };
// Keep sample sessions through Next development hot reloads; process restart still clears them.
const workbenchGlobal = globalThis as typeof globalThis & { veilpassWorkbenchSessions?: Map<string, Session> };
const sessions = workbenchGlobal.veilpassWorkbenchSessions ??= new Map<string, Session>();
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: NextRequest) {
  if (process.env.VEILPASS_WORKBENCH !== '1') return NextResponse.json({ error: 'Developer workbench is disabled. Start with VEILPASS_WORKBENCH=1 npm run dev.', code: 'DISABLED' }, {status:503,headers});
  let origin: URL;
  try { origin = new URL(request.headers.get('origin') || ''); } catch { return NextResponse.json({error:'Origin required'}, {status:403,headers}); }
  if (origin.host !== request.headers.get('host') || !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) return NextResponse.json({error:'Workbench requires same-origin loopback access'}, {status:403,headers});
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Body required');
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const {done,value} = await reader.read(); if(done) break;
      size += value.length;
      if(size > 8192) { await reader.cancel(); return NextResponse.json({error:'Request too large'}, {status:413,headers}); }
      chunks.push(value);
    }
    const input = new Uint8Array(size); let offset=0;
    for(const chunk of chunks) {input.set(chunk,offset);offset+=chunk.length;}
    const body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(input));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Body must be an object');
    const now = Date.now(); for (const [key,s] of sessions) if (s.expires < now) sessions.delete(key);
    let id = request.cookies.get('veilpass-workbench')?.value;
    let session = id ? sessions.get(id) : undefined;
    if (!session) {
      if (body.action !== 'initialize') return NextResponse.json({error:'Initialize a new development session first'}, {status:409,headers});
      if (sessions.size >= 16) return NextResponse.json({error:'Workbench session limit reached'}, {status:429,headers});
      id = randomBytes(32).toString('hex');
      const directory = path.resolve('.private','workbench',id);
      session = { engine: new Workbench({ 'approved-training':new FileChallengeStore(path.join(directory,'hackathon')), 'professional-level':new FileChallengeStore(path.join(directory,'community')) }), expires:now + 3600000,calls:0,window:now };
      sessions.set(id,session);
    }
    if (now-session.window > 60000) {session.calls=0;session.window=now;}
    if (++session.calls > 60) return NextResponse.json({error:'Too many workbench actions; retry in one minute'}, {status:429,headers});
    const engine = session.engine;
    let result: unknown;
    const policy = body.policy as PolicyId;
    if (['challenge','verify'].includes(body.action) && !['approved-training','professional-level'].includes(policy)) throw new Error('Select a supported policy');
    switch(body.action) {
      case 'initialize': case 'status': break;
      case 'challenge': result = await engine.challenge(policy); break;
      case 'authorize': result = engine.authorize(body.challengeId, body.basic === true); break;
      case 'verify': result = await engine.verifier(policy).verifyPresentation(body.presentation); break;
      case 'revoke': engine.revoke(); break;
      case 'deactivate': engine.deactivate(); break;
      default: return NextResponse.json({error:'Unsupported action'}, {status:400,headers});
    }
    const response = NextResponse.json({ ...engine.view(), result }, {headers});
    response.cookies.set('veilpass-workbench',id!,{httpOnly:true,sameSite:'strict',maxAge:3600,path:'/'});
    return response;
  } catch(e) {
    // Only known constraint messages are exposed; witness/error payloads stay private.
    const message = e instanceof Error ? e.message : '';
    const known = ['Credential is revoked','Issuer is inactive','Qualification level too low','Challenge already consumed','Challenge expired','Credential expired','Unknown challenge','Select a supported policy'];
    const safe = e instanceof VeilPassError ? e.message : known.find(m=>message.includes(m)) || 'Workbench action failed. Retry or initialize a new session.';
    return NextResponse.json({error:safe,code:e instanceof VeilPassError ? e.code:'CONSTRAINT'},{status:400,headers});
  }
}
