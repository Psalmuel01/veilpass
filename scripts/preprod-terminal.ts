// Dedicated Preprod-only operator. Never imports a personal browser wallet seed.
import './check-node.mjs';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, lstat, readFile, writeFile, rename } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { firstValueFrom, filter, timeout } from 'rxjs';
import { boundedDustWallet } from '../packages/network/dust-fee.js';
import pino from 'pino';
import { WebSocket } from 'ws';
import { MidnightWalletProvider, WalletSeeds, logger as sdkLogger, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { createKeystore, ShieldedWallet, DustWallet, UnshieldedWallet, WalletFacade, InMemoryTransactionHistoryStorage, WalletEntrySchema, mergeWalletEntries } from '@midnight-ntwrk/wallet-sdk';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import { encryptBackup, decryptBackup } from '../integrations/issuance/src/backup.js';
import { decodeWire, encodeWire } from '../integrations/issuance/src/wire.js';
import { operatorStorage } from '../integrations/issuance/src/operator-storage.js';
import { IssuerAuthority } from '../integrations/issuance/src/index.js';
import { ActiveStatusTree } from '../integrations/issuance/src/status-tree.js';
import { label, hex } from '../integrations/issuance/src/crypto.js';
import { Contract, pureCircuits } from '../integrations/issuance/managed-authorization/contract/index.js';
import { witnessesV3, type PrivateStateV3 } from '../integrations/issuance/src/contract.js';
import { memoryPrivateStateProvider } from '../packages/credential/memory-provider.js';

process.umask(0o077);
// Testkit's default logger prints seeds: suppress both logger paths before building.
sdkLogger.level='silent';
const quiet=pino({level:'silent'});
const operatorLog=console.log.bind(console),operatorError=console.error.bind(console);
// Dependency loggers otherwise print authenticated endpoint URLs. Emit only our public reports.
for(const method of ['log','info','warn','error','debug'] as const)console[method]=()=>{};
globalThis.WebSocket=WebSocket as unknown as typeof globalThis.WebSocket;
setNetworkId('preprod');
const [envFile,action]=process.argv.slice(2);
if(['register','deploy','bootstrap','acceptance','publish'].includes(action)&&!process.argv.includes('--submit'))throw Error('Mutation requires --submit');
if(!envFile || !['init','status','register','deploy','bootstrap','acceptance','publish'].includes(action))throw Error('Usage: preprod-terminal <private-env-file> init|status|register|deploy|bootstrap|acceptance|publish [--submit]');
const env=parseEnv(await readFile(envFile,'utf8'));
const password=env.VEILPASS_ISSUER_STORAGE_KEY,token=env.BLOCKFROST_PROJECT_ID;
if(!password || !token)throw Error('Existing private storage key and Blockfrost project required');
const directory=path.resolve('.private/preprod-terminal');
await mkdir(directory,{recursive:true,mode:0o700});
async function ownerOnly(target:string,directory=false){const s=await lstat(target);if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile())||(s.mode&0o077)||(process.getuid&&s.uid!==process.getuid()))throw Error('Owner-only private storage required');}
await ownerOnly(directory,true);
const seedFile=path.join(directory,'wallet.backup.json');
let seed:string;
try{
 await ownerOnly(seedFile);
 const value=JSON.parse(await decryptBackup(await readFile(seedFile,'utf8'),password)) as {version:number;network:string;seed:string};
 if(value.version!==1 || value.network!=='preprod' || !/^[a-f0-9]{64}$/.test(value.seed))throw Error('Invalid operator wallet backup');
 seed=value.seed;
}catch(error){
 if((error as NodeJS.ErrnoException).code!=='ENOENT')throw Error('Operator wallet backup unavailable or invalid. Refusing replacement.');
 if(action!=='init')throw Error('Initialize the dedicated operator wallet first');
 seed=randomBytes(32).toString('hex');
 const plain=JSON.stringify({version:1,network:'preprod',seed});
 const encrypted=await encryptBackup(plain,password);
 if(await decryptBackup(encrypted,password)!==plain)throw Error('Operator recovery check failed');
 await writeFile(seedFile,encrypted,{mode:0o600,flag:'wx'});
}
const authenticated=(base:string)=>{const u=new URL(base);u.searchParams.set('project_id',token);return u.href;};
const config:EnvironmentConfiguration={networkId:'preprod',walletNetworkId:'preprod',
 indexer:authenticated('https://midnight-preprod.blockfrost.io/api/v0'),indexerWS:authenticated('wss://midnight-preprod.blockfrost.io/api/v0/ws'),
 node:authenticated('https://rpc.midnight-preprod.blockfrost.io'),nodeWS:authenticated('wss://rpc.midnight-preprod.blockfrost.io'),
 proofServer:'http://127.0.0.1:6300',faucet:undefined};
let wallet:MidnightWalletProvider|undefined,started=false;
let checkpointTimer:ReturnType<typeof setInterval>|undefined;
let checkpointBusy=false;
const checkpointPath=path.join(directory,'wallet-state.enc');
const checkpointKey=createHash('sha256').update('veilpass:preprod:wallet-checkpoint:v1\0').update(password).digest();
async function checkpoint(){
 if(!wallet||checkpointBusy)return;checkpointBusy=true;
 try{
 const states=await Promise.all([wallet.wallet.shielded.serializeState(),wallet.wallet.unshielded.serializeState(),wallet.wallet.dust.serializeState()]);
 const plain=gzipSync(Buffer.from(JSON.stringify({network:'preprod',address:wallet.unshieldedKeystore.getBech32Address().asString(),states})));
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',checkpointKey,iv);cipher.setAAD(Buffer.from('veilpass:preprod:wallet-checkpoint:v1'));
 const encrypted=Buffer.concat([iv,cipher.update(plain),cipher.final()]);
 const envelope=Buffer.concat([encrypted.subarray(0,12),cipher.getAuthTag(),encrypted.subarray(12)]);
 await writeFile(checkpointPath+'.tmp',envelope,{mode:0o600});await rename(checkpointPath+'.tmp',checkpointPath);
 }finally{checkpointBusy=false;}
}
let progressSubscription:{unsubscribe():void}|undefined;
let stage='building dedicated operator wallet';
async function deadline<T>(operation:Promise<T>,milliseconds:number,message:string):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),milliseconds);})]);}
 finally{if(timer)clearTimeout(timer);}
}
try{
 const address=createKeystore(WalletSeeds.fromMasterSeed(seed).unshielded,'preprod').getBech32Address().asString();
 const publicWallet={network:'preprod',unshieldedAddress:address,backup:'.private/preprod-terminal/wallet.backup.json',note:'Dedicated test operator; encrypted seed never printed. Matching private storage key required for recovery.'};
 await writeFile(path.join(directory,'wallet-public.json'),JSON.stringify(publicWallet,null,2)+'\n',{mode:0o600});
 if(action==='init'){operatorLog(JSON.stringify(publicWallet,null,2));}
 else{
  wallet=await MidnightWalletProvider.build(quiet,config,seed);seed='';
  try{
   const info=await lstat(checkpointPath);if(info.isSymbolicLink()||info.uid!==process.getuid?.()||(info.mode&0o077)!==0||info.size>134217728)throw Error('Unsafe wallet checkpoint');
   const bytes=await readFile(checkpointPath),decipher=createDecipheriv('aes-256-gcm',checkpointKey,bytes.subarray(0,12));decipher.setAAD(Buffer.from('veilpass:preprod:wallet-checkpoint:v1'));decipher.setAuthTag(bytes.subarray(12,28));
   const saved=JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]),{maxOutputLength:134217728}).toString());
   if(saved.network!=='preprod'||saved.address!==address||saved.states.length!==3)throw Error('Wallet checkpoint identity mismatch');
   const cfg={indexerClientConnection:{indexerHttpUrl:config.indexer,indexerWsUrl:config.indexerWS},provingServerUrl:new URL(config.proofServer),networkId:'preprod',relayURL:new URL(config.nodeWS),txHistoryStorage:new InMemoryTransactionHistoryStorage(WalletEntrySchema,mergeWalletEntries),costParameters:{feeBlocksMargin:5},batchUpdates:{size:500,timeout:50,spacing:0}};
   const restored=await WalletFacade.init({configuration:cfg,shielded:()=>ShieldedWallet(cfg).restore(saved.states[0]),unshielded:()=>UnshieldedWallet(cfg).restore(saved.states[1]),dust:()=>boundedDustWallet(cfg).restore(saved.states[2])});
   const previous=wallet;await previous.stop();wallet=await MidnightWalletProvider.withWallet(quiet,config,restored,previous.zswapSecretKeys,previous.dustSecretKey,previous.unshieldedKeystore);
   operatorLog('Restored encrypted operator synchronization checkpoint.');
  }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(wallet.unshieldedKeystore.getBech32Address().asString()!==address)throw Error('Operator address mismatch');
  stage='starting Preprod wallet SDK';operatorLog('Synchronizing dedicated Preprod operator; no personal wallet access.');
  let lastProgress='',lastProgressAt=0;
  progressSubscription=wallet.wallet.state().subscribe({next:s=>{
   const detail=(p:{isStrictlyComplete():boolean;appliedIndex:bigint;highestIndex:bigint;highestRelevantIndex:bigint;highestRelevantWalletIndex:bigint;isConnected:boolean})=>({synced:p.isStrictlyComplete(),connected:p.isConnected,applied:String(p.appliedIndex),target:String(p.highestRelevantWalletIndex),highest:String(p.highestIndex),relevant:String(p.highestRelevantIndex)});
   const progress=JSON.stringify({shielded:detail(s.shielded.state.progress),unshieldedSynced:s.unshielded.progress.isStrictlyComplete(),dust:detail(s.dust.state.progress)});
   if(progress!==lastProgress&&Date.now()-lastProgressAt>=15000){lastProgressAt=Date.now();lastProgress=progress;operatorLog('Wallet sync progress: '+progress);}
  },error:()=>operatorLog('Wallet state stream reported an error; no transaction submitted.')});
  await deadline(wallet.start(false),90000,'Wallet SDK start timed out');started=true;checkpointTimer=setInterval(()=>{void checkpoint().catch(()=>operatorError('Encrypted checkpoint save failed.'));},30000);
  stage='waiting for synchronized Preprod wallet state';
  let state=await deadline(wallet.wallet.waitForSyncedState(),21600000,'Wallet synchronization timed out');
  const night=state.unshielded.balances[unshieldedToken().raw]??0n;let dust=state.dust.balance(new Date());
  const coins=state.unshielded.availableCoins.filter(c=>c.utxo.type===unshieldedToken().raw && c.meta.registeredForDustGeneration===false);
  const report={checkedAt:new Date().toISOString(),network:'preprod',unshieldedAddress:address,nightBaseUnits:night.toString(),dustBaseUnits:dust.toString(),unregisteredNightOutputs:coins.length,synced:true};
  await writeFile(path.join(directory,'wallet-status.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});operatorLog(JSON.stringify(report,null,2));
  if(action==='publish'){
   stage='publishing hosted status to Preprod';
   await (await import('./preprod-publish.js')).publishPreprodStatus(wallet,config,env as Record<string,string>,directory,operatorLog);
  }
  if(action==='acceptance'){
   stage='running real Preprod authorization acceptance';
   await (await import('./preprod-acceptance.js')).preprodAcceptance(wallet,config,env as Record<string,string>,directory,operatorLog);
  }
  if(action==='register'||(action==='bootstrap'&&coins.length>0)){
   if(!process.argv.includes('--submit'))throw Error('Registration requires --submit');
   if(!coins.length)throw Error('No unregistered test NIGHT available');
   stage='registering dedicated operator test NIGHT for DUST';
   const recipe=await wallet.wallet.registerNightUtxosForDustGeneration(coins,wallet.unshieldedKeystore.getPublicKey(),payload=>wallet!.unshieldedKeystore.signData(payload));
   const finalized=await wallet.wallet.finalizeRecipe(recipe);
   const registrationAttempt=path.join(directory,'registration-attempt.json');
   await writeFile(registrationAttempt,JSON.stringify({state:'submission-started-reconcile-before-retry',network:'preprod',transactionReference:finalized.identifiers()[0],recordedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
   const reference=await wallet.wallet.submitTransaction(finalized);
   const result={submittedAt:new Date().toISOString(),network:'preprod',transactionReference:reference,action:'test-night-dust-registration'};
   await writeFile(path.join(directory,'registration.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});operatorLog(JSON.stringify(result,null,2));
  }
  if(action==='bootstrap'&&dust<=0n){
   stage='waiting for confirmed DUST generation';operatorLog('Waiting for confirmed DUST generation before deployment.');
   state=await firstValueFrom(wallet.wallet.state().pipe(filter(s=>s.dust.state.progress.isStrictlyComplete()&&s.unshielded.progress.isStrictlyComplete()&&s.dust.balance(new Date())>0n),timeout(1800000)));
   dust=state.dust.balance(new Date());
  }
  if(action==='deploy'||action==='bootstrap'){
   if(!process.argv.includes('--submit'))throw Error('Deployment requires --submit');
   if(dust<=0n)throw Error('Operator needs generated tDUST before deployment');
   const attempt=path.join(directory,'deployment-attempt.json');
   try{await lstat(attempt);throw Error('Prior deployment attempt exists. Reconcile before retrying.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   const db=operatorStorage({...env,VEILPASS_DATABASE_TRANSPORT:'neon-http'});
   const snapshot=await db.encryptedSnapshot(password);await db.close();
   if(snapshot.fingerprint!==env.VEILPASS_ISSUER_FINGERPRINT)throw Error('Hosted issuer mismatch');
   const issuer=IssuerAuthority.fromState(await decryptBackup(snapshot.encrypted,password));
   const trust=issuer.publicTrust(),root=new ActiveStatusTree(issuer.statusEntries()).root();
   const keysPath=path.resolve('.private/preprod-operator/keys.json');await ownerOnly(keysPath);
   const keys=decodeWire(await readFile(keysPath,'utf8')) as {admin:Uint8Array;signingKey:string};
   if(!(keys.admin instanceof Uint8Array)||keys.admin.length!==32||typeof keys.signingKey!=='string')throw Error('Invalid stable contract administration keys');
   const domain=label('veilpass:preprod:signed:v3'),appA=label('veilpass:approved-training:v3'),appB=label('veilpass:professional-level:v3');
   const assets=path.resolve('integrations/issuance/managed-authorization');
   const names=['authorize','publishStatus','deactivate'] as const;
   const hashes=Object.fromEntries(await Promise.all(names.map(async n=>[n,createHash('sha256').update(await readFile(`${assets}/keys/${n}.verifier`)).digest('hex')])));
   const health=await fetch(config.proofServer+'/version',{signal:AbortSignal.timeout(5000)});
   if(!health.ok || (await health.text()).trim()!=='8.1.3')throw Error('Pinned prover unavailable');
   const compiled=CompiledContract.make('veilpass-signed-v3',Contract).pipe(CompiledContract.withWitnesses(witnessesV3),CompiledContract.withCompiledFileAssets(assets));
   const zk=new NodeZkConfigProvider<typeof names[number]>(assets);
   const operator=wallet;
   const providers:MidnightProviders<typeof names[number],string,PrivateStateV3>={zkConfigProvider:zk,
    privateStateProvider:memoryPrivateStateProvider<PrivateStateV3>(),publicDataProvider:indexerPublicDataProvider(config.indexer,config.indexerWS),
    proofProvider:httpClientProofProvider(config.proofServer,zk,{timeout:300000}),walletProvider:operator,
    midnightProvider:{async submitTx(tx){const reference=tx.identifiers()[0];
     await writeFile(attempt,JSON.stringify({state:'submission-started-reconcile-before-retry',network:'preprod',transactionReference:reference,recordedAt:new Date().toISOString()}),{mode:0o600});
     stage='submitting and confirming Preprod contract';operatorLog('Submitting Preprod deployment; no automatic retry.');
     return operator.submitTx(tx);}}};
   await writeFile(attempt,JSON.stringify({state:'preparing',startedAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
   stage='proving and balancing Preprod deployment';operatorLog('Preparing real Preprod contract deployment.');
   const deployed=await deployContract(providers,{compiledContract:compiled,privateStateId:'operator',initialPrivateState:{admin:keys.admin} as PrivateStateV3,signingKey:keys.signingKey,
    args:[trust.method,trust.publicKey,trust.registryId,root,pureCircuits.administratorKey(keys.admin),domain,appA,appB]});
   const result={confirmedAt:new Date().toISOString(),network:'preprod',contractAddress:deployed.deployTxData.public.contractAddress,transactionReference:deployed.deployTxData.public.txId,
    issuerFingerprint:snapshot.fingerprint,authorityVersion:snapshot.authorityVersion,root:hex(root),domain:hex(domain),appA:hex(appA),appB:hex(appB),verifierKeys:hashes,status:'confirmed'};
   await writeFile(path.join(directory,'deployment.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
   await writeFile(path.join(directory,'deployment-config.json'),encodeWire({network:'preprod',contractAddress:result.contractAddress,domain:hex(domain),appA:hex(appA),appB:hex(appB),trust}),{mode:0o600});
   operatorLog(JSON.stringify(result,null,2));
  }
 }
}catch(error){
 const detail=(error instanceof Error?error.message:'Unknown SDK failure').replaceAll(token,'[redacted]').replaceAll(password,'[redacted]').replace(/project_id=[^\s&"'<>]+/g,'project_id=[redacted]').replace(/[a-f0-9]{64}/gi,'[hex-redacted]').slice(0,500);
 operatorError('Failure detail: '+detail);
 operatorError(`Terminal Preprod operation stopped while ${stage}. Secrets and authenticated URLs are suppressed. No automatic retry; inspect the private status/attempt record.`);process.exitCode=1;
}finally{seed='';if(checkpointTimer)clearInterval(checkpointTimer);if(started)try{await checkpoint();}catch{operatorError('Final encrypted checkpoint save failed.');}progressSubscription?.unsubscribe();if(wallet)try{await deadline(wallet.stop(),15000,'Wallet cleanup timed out');}catch{operatorError('Wallet cleanup timed out; closing this terminal process.');process.exitCode=1;}}
await new Promise<void>(resolve=>process.stdout.write('',()=>resolve()));
process.exit(process.exitCode||0);
