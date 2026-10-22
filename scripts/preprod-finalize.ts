// Resume only final read/negative checks from an already confirmed four-tx run.
import assert from 'node:assert/strict';
import{readFile,writeFile}from'node:fs/promises';
import path from'node:path';
import type{MidnightWalletProvider,EnvironmentConfiguration}from'@midnight-ntwrk/testkit-js';
import{CompiledContract}from'@midnight-ntwrk/compact-js';
import{findDeployedContract}from'@midnight-ntwrk/midnight-js/contracts';
import{NodeZkConfigProvider}from'@midnight-ntwrk/midnight-js-node-zk-config-provider';
import{httpClientProofProvider}from'@midnight-ntwrk/midnight-js-http-client-proof-provider';
import{indexerPublicDataProvider}from'@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type{MidnightProviders}from'@midnight-ntwrk/midnight-js/types';
import{Contract,type StatusPath}from'../integrations/issuance/managed-authorization/contract/index.js';
import{witnessesV3,type PrivateStateV3}from'../integrations/issuance/src/contract.js';
import{Holder,decodeWire,type IssuerTrust}from'../integrations/issuance/src/index.js';
import{hex}from'../integrations/issuance/src/crypto.js';
import{SignedMidnightAdapter}from'../integrations/issuance/src/midnight-adapter.js';
import{createSignedVerifier,requestKeyV3,fromHex,type ChallengeV3}from'../integrations/issuance/src/verifier.js';
import{operatorStorage}from'../integrations/issuance/src/operator-storage.js';
import{memoryPrivateStateProvider}from'../packages/credential/memory-provider.js';
export async function finalizePreprodAcceptance(wallet:MidnightWalletProvider,environment:EnvironmentConfiguration,env:Record<string,string>,directory:string,log:(s:string)=>void){
 const c=decodeWire(await readFile('deploy/preprod/network.json','utf8')) as {contractAddress:string;domain:string;appA:string;appB:string;trust:IssuerTrust};
 const credential=JSON.parse(await readFile(path.join(directory,'acceptance-credential.json'),'utf8'));
 const refs=await Promise.all([1,2,3,4].map(async n=>JSON.parse(await readFile(path.join(directory,`acceptance-submission-${n}.json`),'utf8')).transactionReference as string));
 const assets=path.resolve('integrations/issuance/managed-authorization'),verifierKeys={authorize:await readFile(`${assets}/keys/authorize.verifier`),publishStatus:await readFile(`${assets}/keys/publishStatus.verifier`),deactivate:await readFile(`${assets}/keys/deactivate.verifier`)};
 const chain=new SignedMidnightAdapter({indexerUrl:environment.indexer,contractAddress:c.contractAddress,networkDomain:c.domain,trust:c.trust,verifierKeys});
 const db=operatorStorage({...env,VEILPASS_DATABASE_TRANSPORT:'neon-http'}),holder=await Holder.restore(await readFile(path.join(directory,'acceptance-holder.backup.json'),'utf8'),env.VEILPASS_ISSUER_STORAGE_KEY);
 try{
  for(const reference of refs){const response=await fetch(environment.indexer,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'query($offset:TransactionOffset!){transactions(offset:$offset){... on RegularTransaction{transactionResult{status}}}}',variables:{offset:{identifier:reference}}}),signal:AbortSignal.timeout(15000)});const result=await response.json();assert.equal(result.data?.transactions?.[0]?.transactionResult?.status,'SUCCESS');}
  const snapshot=await chain.currentState();assert(snapshot.active);
  for(const [index,reference]of refs.slice(1,3).entries()){
   const auth=await chain.authorization(reference);assert(auth);assert.notEqual(auth.snapshot.root,snapshot.root);assert.notEqual(auth.snapshot.statusVersion,snapshot.statusVersion);
   const namespace=`${c.contractAddress}:${index+1}`,rows=await db.pool.query('SELECT body,used FROM veilpass_challenges WHERE namespace=$1',[namespace]);
   const row=rows.rows.find(r=>requestKeyV3(r.body as ChallengeV3)===auth.requestKey);assert(row?.used,'Actual accepted challenge must be durably consumed');assert.equal(await db.challengeStore(namespace).consume((row.body as ChallengeV3).id),false,'A consumed challenge cannot be consumed twice');
  }
  const issuer=async(suffix:string)=>{const response=await fetch('https://useveilpass.vercel.app/api/issuance?id='+credential.id+suffix,{signal:AbortSignal.timeout(65000)});assert(response.ok);return decodeWire(await response.text());};
  assert.equal(((await issuer(''))as{revoked:boolean}).revoked,true);
  const membership=await issuer('&path=1')as{root:Uint8Array;path:StatusPath};assert.equal(hex(membership.root),snapshot.root,'Hosted and chain revocation roots must match');
  const verifier=createSignedVerifier({audience:c.appA,domain:c.domain,contractAddress:c.contractAddress,policy:1,chain,store:db.challengeStore(`${c.contractAddress}:1`)}),challenge=await verifier.createChallenge(300);
  const witness=holder.present(credential.id,{domain:fromHex(c.domain),audience:fromHex(c.appA),policy:1n,challenge:fromHex(challenge.nonce),expiresAt:BigInt(challenge.expiresAt)});
  const zk=new NodeZkConfigProvider<'authorize'|'publishStatus'|'deactivate'>(assets),base=httpClientProofProvider(environment.proofServer,zk,{timeout:300000});let proofCalls=0;
  const providers:MidnightProviders<'authorize'|'publishStatus'|'deactivate',string,PrivateStateV3>={zkConfigProvider:zk,privateStateProvider:memoryPrivateStateProvider<PrivateStateV3>(),publicDataProvider:indexerPublicDataProvider(environment.indexer,environment.indexerWS),walletProvider:wallet,proofProvider:{async proveTx(tx,options){proofCalls++;return base.proveTx(tx,options);}},midnightProvider:{async submitTx(){throw Error('Unexpected submission during revoked-credential rejection test');}}};
  const compiled=CompiledContract.make('veilpass-signed-v3',Contract).pipe(CompiledContract.withWitnesses(witnessesV3),CompiledContract.withCompiledFileAssets(assets));
  const instance=await findDeployedContract(providers,{contractAddress:c.contractAddress,compiledContract:compiled,privateStateId:'revoked-holder',initialPrivateState:{witness,path:membership.path,admin:new Uint8Array(32)}});
  log('Attempting a fresh authorization from the recovered, revoked synthetic credential.');
  await assert.rejects(instance.callTx.authorize(fromHex(c.appA),1n,fromHex(challenge.nonce),witness.proof.createdAt,BigInt(challenge.expiresAt)),/not active/);assert.equal(proofCalls,0,'Revoked membership must fail before proof generation');
  const evidence={checkedAt:new Date().toISOString(),network:'preprod',contractAddress:c.contractAddress,issuerOrigin:'https://useveilpass.vercel.app',statusTransaction:refs[0],authorizationTransactions:refs.slice(1,3),revocationTransaction:refs[3],twoPoliciesVerified:true,durableReplayRejected:true,revokedCredentialRejected:true,revokedCredentialRejectedByCircuit:true,oldReceiptRejectedAfterStatusChange:true,confirmedStatusSnapshotChanged:true,oldReceiptRejectionReason:'Expired receipt; independently confirmed changed status snapshot',encryptedHolderRecovery:true,statusHandleAndClaimsRootAbsentFromPublicTransaction:true,installedWalletAcceptance:false,hostedBrowserProofAcceptance:false,productionReady:false,note:'Real Preprod transactions from the completed proof/verification phase, reconciled against canonical data and consumed Neon challenges. Final fresh revoked authorization rejected by the actual deployed-contract call pipeline after encrypted holder recovery; no invalid transaction submitted. Installed-wallet and hosted-browser proof acceptance remain separate.'};
  await writeFile('docs/evidence/preprod-authorization.json',JSON.stringify(evidence,null,2)+'\n');log('PASS: complete actual Preprod lifecycle reconciled, encrypted holder recovered, fresh revoked authorization rejected.');
 }finally{holder.lock();await db.close();}
}
