import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import type{MidnightWalletProvider,EnvironmentConfiguration}from'@midnight-ntwrk/testkit-js';
import{CompiledContract}from'@midnight-ntwrk/compact-js';
import{findDeployedContract}from'@midnight-ntwrk/midnight-js/contracts';
import{NodeZkConfigProvider}from'@midnight-ntwrk/midnight-js-node-zk-config-provider';
import{httpClientProofProvider}from'@midnight-ntwrk/midnight-js-http-client-proof-provider';
import{indexerPublicDataProvider}from'@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type{MidnightProviders}from'@midnight-ntwrk/midnight-js/types';
import{Contract}from'../integrations/issuance/managed-authorization/contract/index.js';
import{witnessesV3,type PrivateStateV3}from'../integrations/issuance/src/contract.js';
import{decodeWire,IssuerAuthority,type IssuerTrust}from'../integrations/issuance/src/index.js';
import{decryptBackup}from'../integrations/issuance/src/backup.js';
import{ActiveStatusTree}from'../integrations/issuance/src/status-tree.js';
import{hex}from'../integrations/issuance/src/crypto.js';
import{operatorStorage}from'../integrations/issuance/src/operator-storage.js';
import{SignedMidnightAdapter}from'../integrations/issuance/src/midnight-adapter.js';
import{memoryPrivateStateProvider}from'../packages/credential/memory-provider.js';
import{submitAndConfirm}from'../packages/network/confirmed-submit.js';
export async function publishPreprodStatus(wallet:MidnightWalletProvider,environment:EnvironmentConfiguration,env:Record<string,string>,directory:string,log:(s:string)=>void){
 const c=decodeWire(await readFile('deploy/preprod/network.json','utf8')) as {contractAddress:string;domain:string;trust:IssuerTrust};
 const db=operatorStorage({...env,VEILPASS_DATABASE_TRANSPORT:'neon-http'});
 async function latest(){const snapshot=await db.encryptedSnapshot(env.VEILPASS_ISSUER_STORAGE_KEY);if(snapshot.fingerprint!==env.VEILPASS_ISSUER_FINGERPRINT)throw Error('Hosted issuer mismatch');const issuer=IssuerAuthority.fromState(await decryptBackup(snapshot.encrypted,env.VEILPASS_ISSUER_STORAGE_KEY));return{root:new ActiveStatusTree(issuer.statusEntries()).root(),authorityVersion:snapshot.authorityVersion};}
 try{
  const current=await latest(),assets=path.resolve('integrations/issuance/managed-authorization');
  const chain=new SignedMidnightAdapter({indexerUrl:environment.indexer,contractAddress:c.contractAddress,networkDomain:c.domain,trust:c.trust,verifierKeys:{authorize:await readFile(`${assets}/keys/authorize.verifier`),publishStatus:await readFile(`${assets}/keys/publishStatus.verifier`),deactivate:await readFile(`${assets}/keys/deactivate.verifier`)}});
  const snapshot=await chain.currentState();if(!snapshot.active)throw Error('Issuer contract inactive');
  if(snapshot.root===hex(current.root)){log('Hosted issuer status root already matches Preprod; no transaction needed.');return;}
  const keyfile='.private/preprod-operator/keys.json',info=await lstat(keyfile);if(info.isSymbolicLink()||(info.mode&0o077)||info.uid!==process.getuid?.())throw Error('Unsafe contract administrator storage');
  const keys=decodeWire(await readFile(keyfile,'utf8')) as {admin:Uint8Array};
  const attempt=path.join(directory,`status-root-attempt-${hex(current.root)}.json`);
  await writeFile(attempt,JSON.stringify({state:'preparing',root:hex(current.root),authorityVersion:current.authorityVersion}),{mode:0o600,flag:'wx'});
  const zk=new NodeZkConfigProvider<'authorize'|'publishStatus'|'deactivate'>(assets);
  const providers:MidnightProviders<'authorize'|'publishStatus'|'deactivate',string,PrivateStateV3>={zkConfigProvider:zk,privateStateProvider:memoryPrivateStateProvider<PrivateStateV3>(),publicDataProvider:indexerPublicDataProvider(environment.indexer,environment.indexerWS),proofProvider:httpClientProofProvider(environment.proofServer,zk,{timeout:300000}),walletProvider:wallet,midnightProvider:{async submitTx(tx){if(hex((await latest()).root)!==hex(current.root))throw Error('Issuer status changed during proving; nothing submitted');await writeFile(attempt,JSON.stringify({state:'submission-started-reconcile-before-retry',root:hex(current.root),transactionReference:tx.identifiers()[0]}),{mode:0o600});return submitAndConfirm(wallet,tx,environment.indexer);}}};
  const compiled=CompiledContract.make('veilpass-signed-v3',Contract).pipe(CompiledContract.withWitnesses(witnessesV3),CompiledContract.withCompiledFileAssets(assets));
  const instance=await findDeployedContract(providers,{contractAddress:c.contractAddress,compiledContract:compiled,privateStateId:'status-operator',initialPrivateState:{admin:keys.admin}as PrivateStateV3});
  log('Publishing the fresh hosted status root to the pinned Preprod contract.');
  const result=await instance.callTx.publishStatus(current.root);if(result.public.status!=='SucceedEntirely')throw Error('Status publication did not fully succeed');
  const confirmed=await chain.currentState();if(confirmed.root!==hex(current.root))throw Error('Published status root not confirmed');
  const report={checkedAt:new Date().toISOString(),network:'preprod',contractAddress:c.contractAddress,root:confirmed.root,statusVersion:confirmed.statusVersion,authorityVersion:current.authorityVersion,transactionReference:result.public.txId,confirmed:true};
  await writeFile(attempt,JSON.stringify(report),{mode:0o600});await writeFile('docs/evidence/preprod-status.json',JSON.stringify(report,null,2)+'\n');log('Confirmed hosted status publication on Preprod.');
 }finally{await db.close();}
}
