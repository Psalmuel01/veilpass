import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { Workbench } from '../packages/lifecycle/workbench.js';
import { FileChallengeStore } from '../packages/sdk/file-store.js';
import type { PolicyId } from '../packages/sdk/index.js';
// Two independent HTTP listeners and durable verifier stores. Shared developer
// issuer/ledger adapter; generated execution only. No privacy proof is implied.
const directory = await mkdtemp(path.join(os.tmpdir(),'veilpass-origins-'));
const engine = new Workbench({ 'approved-training':new FileChallengeStore(path.join(directory,'hackathon')), 'professional-level':new FileChallengeStore(path.join(directory,'community')) });
const servers:Server[]=[];
async function serve(port:number,policy:PolicyId) {
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  try {
   if(req.method==='POST'&&req.url==='/challenge'){res.end(JSON.stringify(await engine.challenge(policy)));return;}
   if(req.method==='POST'&&req.url==='/verify'){
    let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw new Error('Request too large');}
    res.end(JSON.stringify(await engine.verifier(policy).verifyPresentation(JSON.parse(text))));return;
   }
   res.statusCode=404;res.end(JSON.stringify({error:'Not found'}));
  }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e instanceof Error?e.message:'Rejected'}));}
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});servers.push(server);
 return `http://127.0.0.1:${port}`;
}
try {
 const a=await serve(Number(process.env.VEILPASS_APP_A_PORT||4101),'approved-training');
 const b=await serve(Number(process.env.VEILPASS_APP_B_PORT||4102),'professional-level');
 const post=(origin:string,endpoint:string,body?:unknown)=>fetch(`${origin}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const saved=[];
 for(const origin of [a,b]){
  const challenge=await (await post(origin,'challenge')).json();
  const presentation=engine.authorize(challenge.id);saved.push(presentation);
  const response=await post(origin,'verify',presentation);assert.equal(response.status,200);
  assert.equal((await response.json()).mode,'generated-execution');
  assert.equal((await post(origin,'verify',presentation)).status,400);
 }
 assert.equal((await post(b,'verify',saved[0])).status,400);
 const before=await(await post(a,'challenge')).json(),old=engine.authorize(before.id);
 engine.revoke();assert.equal((await post(a,'verify',old)).status,400);
 for(const origin of [a,b]){
  const c=await(await post(origin,'challenge')).json();assert.throws(()=>engine.authorize(c.id),/revoked/);
 }
 console.log(JSON.stringify({mode:'generated-execution',origins:[a,b],credentialReuse:true,replayRejected:true,wrongVerifierRejected:true,preRevocationAuthorizationRejected:true,newVerificationAfterRevocationRejected:true,note:'Generated Compact constraints + SDK over real HTTP. No ZK proof or chain deployment.'},null,2));
}finally{await Promise.all(servers.map(s=>new Promise<void>(r=>s.close(()=>r()))));await rm(directory,{recursive:true,force:true});}
