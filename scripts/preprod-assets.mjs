// Install public, immutable artifacts pinned to the deployed verifier keys.
import { readFile, mkdir, mkdtemp, rm, cp, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFileSync } from 'node:child_process';
const manifest=JSON.parse(await readFile('deploy/preprod/artifacts.json','utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(sha(await readFile('integrations/issuance/authorization.compact'))!==manifest.authorizationSourceSha256)throw Error('Preprod source changed: compile and deploy a reviewed new release');
if(sha(await readFile('integrations/issuance/qualification.compact'))!==manifest.qualificationSourceSha256||sha(await readFile('integrations/issuance/managed-authorization/contract/index.js'))!==manifest.generatedContractSha256)throw Error('Preprod generated contract changed; pinned assets cannot be reused');
const directory=await mkdtemp(path.join(tmpdir(),'veilpass-public-assets-'));
try{
 const archive=path.join(directory,'artifacts.tar.gz'),hash=createHash('sha256');let bytes=0;
 if(process.env.VEILPASS_ARTIFACT_ARCHIVE){const local=await readFile(process.env.VEILPASS_ARTIFACT_ARCHIVE);bytes=local.length;hash.update(local);await cp(process.env.VEILPASS_ARTIFACT_ARCHIVE,archive);}else{
 const response=await fetch(manifest.url,{signal:AbortSignal.timeout(180000)});
 if(!response.ok||!response.body)throw Error('Pinned public artifact download unavailable');
 await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,encoding,done){bytes+=chunk.length;if(bytes>manifest.bytes)return done(Error('Artifact size exceeded'));hash.update(chunk);done(null,chunk);}}),createWriteStream(archive,{flags:'wx'}));
 }
 if(bytes!==manifest.bytes||hash.digest('hex')!==manifest.sha256)throw Error('Artifact archive hash mismatch');
 const entries=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n');
 if(entries.some(e=>e.startsWith('/')||e.split('/').includes('..')||(!e.endsWith('/')&&!manifest.files[e])))throw Error('Unexpected archive entry');
 const extracted=path.join(directory,'extracted');await mkdir(extracted);execFileSync('tar',['-xzf',archive,'-C',extracted]);
 for(const [name,pin]of Object.entries(manifest.files)){const file=path.join(extracted,name),info=await stat(file);if(!info.isFile()||info.size!==pin.bytes||sha(await readFile(file))!==pin.sha256)throw Error('Pinned proof asset mismatch');}
 for(const destination of ['integrations/issuance/managed-authorization','apps/web/public/zk-signed']){
  await mkdir(destination,{recursive:true});for(const folder of ['keys','zkir'])await cp(path.join(extracted,folder),path.join(destination,folder),{recursive:true});
 }
 console.log('Installed exact public Preprod V3 proving assets; archive and file hashes verified.');
}finally{await rm(directory,{recursive:true,force:true});}
