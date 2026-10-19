import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Workbench } from '../packages/lifecycle/workbench';
import { FileChallengeStore } from '../packages/sdk/file-store';
const directory=await mkdtemp(path.join(os.tmpdir(),'veilpass-bench-'));
try {
 const engine=new Workbench({'approved-training':new FileChallengeStore(path.join(directory,'a')),'professional-level':new FileChallengeStore(path.join(directory,'b'))});
 const evaluation:number[]=[],verification:number[]=[];
 for(let i=0;i<20;i++){
  const c=await engine.challenge('approved-training');const p=engine.authorize(c.id);evaluation.push(p.executionMs);
  const start=performance.now();await engine.verifier('approved-training').verifyPresentation(p);verification.push(performance.now()-start);
 }
 const summary=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return {samples:s.length,medianMs:s[Math.floor(s.length/2)],p95Ms:s[Math.ceil(s.length*.95)-1]};};
 const report={recordedAt:new Date().toISOString(),mode:'generated-execution',environment:{platform:os.platform(),architecture:os.arch(),cpu:os.cpus()[0]?.model,node:process.version},generatedConstraintEvaluation:summary(evaluation),sdkVerificationWithDurableStore:summary(verification),proofGenerationMs:null,transactionConfirmationMs:null,note:'Generated JS constraint execution only; not ZK proving or blockchain verification benchmarks. Includes local filesystem sync in SDK verification.'};
 await writeFile('docs/evidence/lifecycle-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await rm(directory,{recursive:true,force:true});}
