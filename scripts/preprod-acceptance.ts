// Synthetic acceptance against the existing public Preprod deployment.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {CompiledContract} from '@midnight-ntwrk/compact-js';
import {findDeployedContract} from '@midnight-ntwrk/midnight-js/contracts';
import {NodeZkConfigProvider} from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {httpClientProofProvider} from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {indexerPublicDataProvider} from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type {MidnightProviders} from '@midnight-ntwrk/midnight-js/types';
import type {MidnightWalletProvider,EnvironmentConfiguration} from '@midnight-ntwrk/testkit-js';
import {Holder,type IssuerTrust,decodeWire,encodeWire} from '../integrations/issuance/src/index.js';
import {Contract,ledger,type StatusPath} from '../integrations/issuance/managed-authorization/contract/index.js';
import {witnessesV3,type PrivateStateV3} from '../integrations/issuance/src/contract.js';
import {fromHex,createSignedVerifier} from '../integrations/issuance/src/verifier.js';
import {SignedMidnightAdapter} from '../integrations/issuance/src/midnight-adapter.js';
import {operatorStorage} from '../integrations/issuance/src/operator-storage.js';
import {memoryPrivateStateProvider} from '../packages/credential/memory-provider.js';
import {hex} from '../integrations/issuance/src/crypto.js';

export async function preprodAcceptance(wallet:MidnightWalletProvider,environment:EnvironmentConfiguration,env:Record<string,string>,directory:string,log:(s:string)=>void){
 const deployment=decodeWire(await readFile('deploy/preprod/network.json','utf8')) as {contractAddress:string;domain:string;appA:string;appB:string;trust:IssuerTrust};
 const previous=path.join(directory,'acceptance-attempt.json');
 await writeFile(previous,JSON.stringify({startedAt:new Date().toISOString(),contractAddress:deployment.contractAddress,note:'Reconcile transaction records and synthetic credential before rerunning.'}),{mode:0o600,flag:'wx'});
 const assets=path.resolve('integrations/issuance/managed-authorization');
 const keys=decodeWire(await readFile('.private/preprod-operator/keys.json','utf8')) as {admin:Uint8Array};
 const states=memoryPrivateStateProvider<PrivateStateV3>(),zk=new NodeZkConfigProvider<'authorize'|'publishStatus'|'deactivate'>(assets);
 let count=0;
 const providers:MidnightProviders<'authorize'|'publishStatus'|'deactivate',string,PrivateStateV3>={
  zkConfigProvider:zk,privateStateProvider:states,publicDataProvider:indexerPublicDataProvider(environment.indexer,environment.indexerWS),
  proofProvider:{async proveTx(tx,options){log('Generating the contract proof with the trusted loopback prover.');return httpClientProofProvider(environment.proofServer,zk,{timeout:300000}).proveTx(tx,options);}},walletProvider:{getCoinPublicKey:()=>wallet.getCoinPublicKey(),getEncryptionPublicKey:()=>wallet.getEncryptionPublicKey(),async balanceTx(tx,ttl){log('Balancing the contract transaction with DUST.');const result=await wallet.balanceTx(tx,ttl);log('DUST balancing completed.');return result;}},
  midnightProvider:{async submitTx(tx){const id=++count;await writeFile(path.join(directory,`acceptance-submission-${id}.json`),JSON.stringify({recordedAt:new Date().toISOString(),transactionReference:tx.identifiers()[0]}),{mode:0o600,flag:'wx'});return wallet.submitTx(tx);}},
 };
 const compiled=CompiledContract.make('veilpass-signed-v3',Contract).pipe(CompiledContract.withWitnesses(witnessesV3),CompiledContract.withCompiledFileAssets(assets));
 const contract=await findDeployedContract(providers,{compiledContract:compiled,contractAddress:deployment.contractAddress,privateStateId:'acceptance',initialPrivateState:{admin:keys.admin} as PrivateStateV3});
 const origin='https://useveilpass.vercel.app';
 async function issuer(body?:unknown,id?:string,path=false):Promise<any>{
  const response=await fetch(`${origin}/api/issuance${id?`?id=${id}${path?'&path=1':''}`:''}`,{method:body?'POST':'GET',headers:{origin,'content-type':'application/json',...(body?{authorization:`Bearer ${env.VEILPASS_ISSUER_ADMIN_TOKEN}`}:{})},...(body?{body:encodeWire(body)}:{}),signal:AbortSignal.timeout(65000),redirect:'error'});
  if(!response.ok)throw Error(`Hosted issuer acceptance failed: HTTP ${response.status}`);return decodeWire(await response.text());
 }
 const db=operatorStorage({...env,VEILPASS_DATABASE_TRANSPORT:'neon-http'}),holder=new Holder();let id:string|undefined,revoked=false;
 const transactions:string[]=[];let statusTransaction='',revocationTransaction='';
 try{
  log('Enrolling a synthetic holder through the live hosted issuer.');
  const trust=await issuer(),offer=await issuer({action:'approve',level:2,holder:holder.publicIdentity()});
  const credential=await issuer({action:'issue',request:holder.request(offer)});id=holder.accept(credential,trust);
  await writeFile(path.join(directory,'acceptance-credential.json'),JSON.stringify({id,synthetic:true}),{mode:0o600});
  const membership=await issuer(undefined,id,true) as {root:Uint8Array;path:StatusPath};
  log('Publishing the hosted issuer status root on Preprod.');
  const published=await contract.callTx.publishStatus(membership.root);assert.equal(published.public.status,'SucceedEntirely');statusTransaction=published.public.txId;
  const chain=new SignedMidnightAdapter({indexerUrl:environment.indexer,contractAddress:deployment.contractAddress,networkDomain:deployment.domain,trust:deployment.trust,verifierKeys:{authorize:await readFile(`${assets}/keys/authorize.verifier`),publishStatus:await readFile(`${assets}/keys/publishStatus.verifier`),deactivate:await readFile(`${assets}/keys/deactivate.verifier`)}});
  const verifiers=[deployment.appA,deployment.appB].map((audience,index)=>createSignedVerifier({audience,domain:deployment.domain,contractAddress:deployment.contractAddress,policy:(index+1) as 1|2,store:db.challengeStore(`${deployment.contractAddress}:${index+1}`),chain}));
  const presentations=[];
  for(let index=0;index<2;index++){
   log(`Generating and submitting actual Preprod authorization for application ${index+1}.`);
   const challenge=await verifiers[index].createChallenge(300),witness=holder.present(id,{domain:fromHex(deployment.domain),audience:fromHex(challenge.audience),policy:BigInt(challenge.policy),challenge:fromHex(challenge.nonce),expiresAt:BigInt(challenge.expiresAt)});
   await states.set('acceptance',{witness,path:membership.path,admin:keys.admin});
   const result=await contract.callTx.authorize(fromHex(challenge.audience),BigInt(challenge.policy),fromHex(challenge.nonce),witness.proof.createdAt,BigInt(challenge.expiresAt));assert.equal(result.public.status,'SucceedEntirely');
   const presentation={version:3 as const,challengeId:challenge.id,transactionReference:result.public.txId};
   assert.equal((await verifiers[index].verify(presentation)).eligible,true);await assert.rejects(verifiers[index].verify(presentation),/consumed/);
   const raw=hex(result.public.tx.serialize());assert(!raw.includes(hex(credential.credential.claimRoot)));assert(!raw.includes(hex(credential.credential.statusBinding.statusHandleCommitment)));
   presentations.push(presentation);transactions.push(result.public.txId);
  }
  log('Revoking only the synthetic credential and publishing its new status root.');
  await issuer({action:'revoke',id});revoked=true;const after=await issuer(undefined,id,true) as {root:Uint8Array;path:StatusPath};
  const update=await contract.callTx.publishStatus(after.root);assert.equal(update.public.status,'SucceedEntirely');revocationTransaction=update.public.txId;
  await assert.rejects(verifiers[1].verify(presentations[1]),/Status changed/);
  const challenge=await verifiers[0].createChallenge(300),witness=holder.present(id,{domain:fromHex(deployment.domain),audience:fromHex(deployment.appA),policy:1n,challenge:fromHex(challenge.nonce),expiresAt:BigInt(challenge.expiresAt)});
  await states.set('acceptance',{witness,path:after.path,admin:keys.admin});await assert.rejects(contract.callTx.authorize(fromHex(deployment.appA),1n,fromHex(challenge.nonce),witness.proof.createdAt,BigInt(challenge.expiresAt)),/not active/);
  const current=await providers.publicDataProvider.queryContractState(deployment.contractAddress);assert(current&&ledger(current.data).statusVersion>=2n);
  const evidence={checkedAt:new Date().toISOString(),network:'preprod',contractAddress:deployment.contractAddress,issuerOrigin:origin,statusTransaction,authorizationTransactions:transactions,revocationTransaction,twoPoliciesVerified:true,durableReplayRejected:true,revokedCredentialRejected:true,oldReceiptRejectedAfterStatusChange:true,statusHandleAndClaimsRootAbsentFromPublicTransaction:true,installedWalletAcceptance:false,hostedBrowserProofAcceptance:false,productionReady:false,note:'Actual Preprod transactions, hosted authenticated issuance and Neon-backed verifier replay storage. Dedicated terminal operator, synthetic holder; not installed-wallet or external-pilot acceptance.'};
  await writeFile('docs/evidence/preprod-authorization.json',JSON.stringify(evidence,null,2)+'\n');log('PASS: both actual Preprod authorizations, replay checks and revocation acceptance.');
 }finally{
  if(id&&!revoked){try{await issuer({action:'revoke',id});log('Synthetic credential revoked after incomplete acceptance; publish the latest status root before enabling proofs.');}catch{log('Acceptance cleanup needs operator reconciliation; synthetic credential reference is in the private acceptance record.');}}
  holder.lock();await db.close();
 }
}
