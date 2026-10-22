// Private, loopback-only installed-wallet deployment ceremony. Never reads wallet seeds.
import './check-node.mjs';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { WebSocket } from 'ws';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { Transaction, sampleSigningKey } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import { MidnightBech32m, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import { Contract, pureCircuits } from '../integrations/issuance/managed-authorization/contract/index.js';
import { witnessesV3, type PrivateStateV3 } from '../integrations/issuance/src/contract.js';
import { IssuerAuthority } from '../integrations/issuance/src/index.js';
import { ActiveStatusTree } from '../integrations/issuance/src/status-tree.js';
import { label, hex } from '../integrations/issuance/src/crypto.js';
import { encodeWire, decodeWire } from '../integrations/issuance/src/wire.js';
import { decryptBackup } from '../integrations/issuance/src/backup.js';
import { operatorStorage } from '../integrations/issuance/src/operator-storage.js';
import { memoryPrivateStateProvider } from '../packages/credential/memory-provider.js';
import path from 'node:path';

process.umask(0o077);
if (!process.argv[2]) throw Error('Usage: preprod-operator <private-env-file> [--check]');
const env=parseEnv(await readFile(process.argv[2],'utf8'));
const storageKey=env.VEILPASS_ISSUER_STORAGE_KEY;
if(!storageKey)throw Error('Issuer storage key missing');
const db=operatorStorage({...env,VEILPASS_DATABASE_TRANSPORT:'neon-http'});
const snapshot=await db.encryptedSnapshot(storageKey);await db.close();
if(snapshot.fingerprint!==env.VEILPASS_ISSUER_FINGERPRINT) throw Error('Hosted issuer fingerprint mismatch');
const issuer=IssuerAuthority.fromState(await decryptBackup(snapshot.encrypted,storageKey));
const trust=issuer.publicTrust(), root=new ActiveStatusTree(issuer.statusEntries()).root();
const token=env.BLOCKFROST_PROJECT_ID || '';
if(!token) throw Error('Blockfrost project missing');
const directory=path.resolve('.private/preprod-operator');await mkdir(directory,{recursive:true,mode:0o700});
const dirStat=await lstat(directory);
if(!dirStat.isDirectory() || dirStat.isSymbolicLink() || (dirStat.mode&0o077) || (process.getuid && dirStat.uid!==process.getuid())) throw Error('Owner-only operator directory required');
const keyFile=path.join(directory,'keys.json');
let keys:{admin:Uint8Array; signingKey:ReturnType<typeof sampleSigningKey>};
try {
 const stat=await lstat(keyFile);
 if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)||(process.getuid && stat.uid!==process.getuid())) throw Error('Unsafe operator key file');
 keys=decodeWire(await readFile(keyFile,'utf8')) as typeof keys;
} catch(error) {
 if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;
 keys={admin:new Uint8Array(randomBytes(32)),signingKey:sampleSigningKey()};
 await writeFile(keyFile,encodeWire(keys),{mode:0o600,flag:'wx'});
}
const domain=label('veilpass:preprod:signed:v3'),appA=label('veilpass:approved-training:v3'),appB=label('veilpass:professional-level:v3');
const assets=path.resolve('integrations/issuance/managed-authorization');
const names=['authorize','publishStatus','deactivate'] as const;
const hashes=Object.fromEntries(await Promise.all(names.map(async name=>[name,createHash('sha256').update(await readFile(`${assets}/keys/${name}.verifier`)).digest('hex')])));
const plan={preparedAt:new Date().toISOString(),network:'preprod',issuerFingerprint:snapshot.fingerprint,authorityVersion:snapshot.authorityVersion,
 root:hex(root),administratorCommitment:hex(pureCircuits.administratorKey(keys.admin)),domain:hex(domain),appA:hex(appA),appB:hex(appB),verifierKeys:hashes,
 keyBackupLocation:'.private/preprod-operator/keys.json',submission:'Requires installed Lace and explicit operator wallet approval',status:'prepared-not-deployed'};
await writeFile(path.join(directory,'plan.json'),JSON.stringify(plan,null,2)+'\n',{mode:0o600});
if(!(keys.admin instanceof Uint8Array)||keys.admin.length!==32||typeof keys.signingKey!=='string')throw Error('Invalid operator keys');
if(process.argv.includes('--check')) {console.log(JSON.stringify(plan,null,2));process.exit(0);}
try{await lstat(path.join(directory,'attempt.json'));throw Error('A prior deployment attempt exists. Reconcile its transaction before another attempt.');}
catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}

setNetworkId('preprod');globalThis.WebSocket=WebSocket as unknown as typeof globalThis.WebSocket;
const session=process.env.VEILPASS_OPERATOR_SESSION || randomBytes(32).toString('hex');
if(!/^[a-f0-9]{64}$/.test(session))throw Error('Invalid private operator session');
const origin='http://127.0.0.1:8788';
let phase='Ready to connect Lace. No transaction submitted.',busy=false;
type Command={id:string;method:'balanceUnsealedTransaction'|'submitTransaction';argument:string};
let command:Command|undefined;
const replies=new Map<string,{resolve:(value:string)=>void;reject:(error:Error)=>void}>();
function walletCommand(method:Command['method'],argument:string):Promise<string>{
 if(command)throw Error('Wallet request already pending');
 const id=randomBytes(16).toString('hex');command={id,method,argument};
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{replies.delete(id);command=undefined;reject(Error('Wallet response timed out. Reconcile before retrying.'));},300000);
  replies.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
 });
}
async function deploy(addresses:{shieldedCoinPublicKey:string;shieldedEncryptionPublicKey:string}){
 const currentDb=operatorStorage({...env,VEILPASS_DATABASE_TRANSPORT:'neon-http'});
 try { const current=await currentDb.encryptedSnapshot(storageKey!);
  if(current.fingerprint!==snapshot.fingerprint || current.authorityVersion!==snapshot.authorityVersion)
   throw Error('Authority changed. Refresh the plan before deployment.');
 } finally { await currentDb.close(); }
 const health=await fetch('http://127.0.0.1:6301/version',{signal:AbortSignal.timeout(5000)});
 if(!health.ok || (await health.text()).trim()!=='8.1.3')throw Error('Pinned local prover unavailable');
 await writeFile(path.join(directory,'attempt.json'),JSON.stringify({startedAt:new Date().toISOString(),state:'pending-reconcile-before-retry'}),{mode:0o600,flag:'wx'});
 const rpcUrl=new URL('https://midnight-preprod.blockfrost.io/api/v0');rpcUrl.searchParams.set('project_id',token);
 const wsUrl=new URL('wss://midnight-preprod.blockfrost.io/api/v0/ws');wsUrl.searchParams.set('project_id',token);
 const decode=(value:string,coin:boolean)=>/^[0-9a-f]{64}$/i.test(value)?value:coin?ShieldedCoinPublicKey.codec.decode('preprod',MidnightBech32m.parse(value)).toHexString():ShieldedEncryptionPublicKey.codec.decode('preprod',MidnightBech32m.parse(value)).toHexString();
 const zk=new NodeZkConfigProvider<typeof names[number]>(assets);
 const providers:MidnightProviders<typeof names[number],string,PrivateStateV3>={
  zkConfigProvider:zk,privateStateProvider:memoryPrivateStateProvider<PrivateStateV3>(),
  publicDataProvider:indexerPublicDataProvider(rpcUrl.href,wsUrl.href),
  proofProvider:httpClientProofProvider('http://127.0.0.1:6301',zk,{timeout:300000}),
  walletProvider:{getCoinPublicKey:()=>decode(addresses.shieldedCoinPublicKey,true),getEncryptionPublicKey:()=>decode(addresses.shieldedEncryptionPublicKey,false),
   async balanceTx(tx){phase='Review the deployment in Lace. Approval is your decision.';const result=await walletCommand('balanceUnsealedTransaction',hex(tx.serialize()));return Transaction.deserialize('signature','proof','binding',Uint8Array.from(Buffer.from(result,'hex')));}},
  midnightProvider:{async submitTx(tx){const reference=tx.identifiers()[0];
   await writeFile(path.join(directory,'attempt.json'),JSON.stringify({state:'awaiting-user-submit',transactionReference:reference,recordedAt:new Date().toISOString()}),{mode:0o600});
   phase='Balanced. Review and click Submit approved deployment to send it to Preprod.';
   await walletCommand('submitTransaction',hex(tx.serialize()));phase='Submitted. Waiting for indexed confirmation; do not retry.';return reference;}}
 };
 phase='Preparing the Preprod contract deployment.';
 const compiled=CompiledContract.make('veilpass-signed-v3',Contract).pipe(CompiledContract.withWitnesses(witnessesV3),CompiledContract.withCompiledFileAssets(assets));
 const deployed=await deployContract(providers,{compiledContract:compiled,privateStateId:'operator',
  initialPrivateState:{admin:keys.admin} as PrivateStateV3,signingKey:keys.signingKey,
  args:[trust.method,trust.publicKey,trust.registryId,root,pureCircuits.administratorKey(keys.admin),domain,appA,appB]});
 const result={...plan,status:'confirmed',contractAddress:deployed.deployTxData.public.contractAddress,transactionReference:deployed.deployTxData.public.txId,confirmedAt:new Date().toISOString()};
 await writeFile(path.join(directory,'deployment.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});
 // Token-free endpoints are intentionally absent until the constrained hosted gateway is accepted.
 await writeFile(path.join(directory,'deployment-config.json'),encodeWire({network:'preprod',contractAddress:result.contractAddress,domain:hex(domain),appA:hex(appA),appB:hex(appB),trust}),{mode:0o600});
 phase='Deployment confirmed: '+result.contractAddress+'. Run read-only release acceptance before enabling the hosted network.';
}
const walletClient=await readFile(new URL('../packages/network/wallet-connection.mjs',import.meta.url),'utf8');
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VeilPass Preprod operator</title><style>body{font:18px system-ui;background:#101625;color:#edf2ff;max-width:850px;margin:5vh auto;padding:24px}button{padding:14px;margin:8px;background:#b3c3ff;border:0;border-radius:8px;cursor:pointer}pre{white-space:pre-wrap;word-break:break-word;font-size:14px}#status{padding:20px;background:#202c46}small{color:#bbcae8}</style><h1>VeilPass · Preprod deployment</h1><p>Private operator console. The public website remains on Vercel. This page connects to your installed Lace; wallet passwords and seeds stay in Lace.</p><p>No transaction is submitted until you approve it in Lace and click the separate submission button.</p><button id="connect">1. Connect Lace on Preprod</button><button id="deploy" disabled>2. Prepare deployment for review</button><button id="submit" disabled>3. Submit approved deployment</button><p id="status">Ready. No transaction submitted.</p><h2>Deployment plan</h2><pre id="plan"></pre><small>Operator keys stay in an owner-only ignored file on this Mac. Back up that file privately. A confirmed deployment does not enable public proofs automatically.</small><script type="module" nonce="${session}">
import { connectWithTimeout } from "/wallet-client.mjs";
const $=id=>document.getElementById(id);let api,handling=false,pendingSubmit;
async function post(action,body){const r=await fetch('/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Operator request rejected');return r.json();}
$('connect').onclick=async()=>{const button=$('connect');button.disabled=true;try{const entries=Object.values(window.midnight||{}).filter(x=>/lace/i.test(x.name||x.rdns||''));const found=entries.find(x=>/^4[.]/.test(x.apiVersion||''))||entries[0];if(!found)throw Error('Install or enable Midnight Lace for this page.');$('status').textContent='Connecting to '+found.name+' · API '+found.apiVersion;api=await connectWithTimeout(found,'preprod',message=>$('status').textContent=message);$('deploy').disabled=false;$('status').textContent='Lace connected on Preprod. Review the deployment plan below.';}catch(e){$('status').textContent=e.message||'Wallet connection failed';}finally{button.disabled=false;}};
$('deploy').onclick=async()=>{try{if((await api.getConfiguration()).networkId!=='preprod')throw Error('Wallet network changed');$('deploy').disabled=true;await post('deploy',await api.getShieldedAddresses());}catch(e){$('status').textContent=e.message;}};
$('submit').onclick=async()=>{if(!pendingSubmit)return;const c=pendingSubmit;pendingSubmit=null;$('submit').disabled=true;try{if((await api.getConfiguration()).networkId!=='preprod')throw Error('Wallet network changed');await api.submitTransaction(c.argument);await post('reply',{id:c.id,value:''});}catch(e){await post('reply',{id:c.id,error:true});}};
async function poll(){try{const data=await(await fetch('/state')).json();$('plan').textContent=JSON.stringify(data.plan,null,2);if(data.phase!=='Ready to connect Lace. No transaction submitted.')$('status').textContent=data.phase;const c=data.command;if(c&&!handling&&api){if(c.method==='submitTransaction'){pendingSubmit=c;$('submit').disabled=false;}else{handling=true;try{if((await api.getConfiguration()).networkId!=='preprod')throw Error();const result=await api.balanceUnsealedTransaction(c.argument);await post('reply',{id:c.id,value:result.tx});}catch(e){await post('reply',{id:c.id,error:true});}finally{handling=false;}}}}catch(e){}setTimeout(poll,1000);}poll();</script>`;
const server=createServer(async(req,res)=>{
 const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':`default-src 'none'; script-src 'self' 'nonce-${session}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'`};
 const send=(status:number,value:unknown,extra:Record<string,string>={})=>{res.writeHead(status,{...headers,'content-type':'application/json',...extra});res.end(typeof value==='string'?value:JSON.stringify(value));};
 try{
 if(req.headers.host!=='127.0.0.1:8788')return send(403,{});
 if(req.url===`/open/${session}`&&req.method==='GET')return send(303,'',{location:'/', 'set-cookie':`vp_operator=${session}; HttpOnly; SameSite=Strict; Path=/`});
 if(!req.headers.cookie?.split(';').map(x=>x.trim()).includes(`vp_operator=${session}`))return send(403,{});
 if(req.method==='GET'&&req.url==='/')return send(200,html,{'content-type':'text/html; charset=utf-8'});
 if(req.method==='GET'&&req.url==='/wallet-client.mjs')return send(200,walletClient,{'content-type':'text/javascript; charset=utf-8'});
 if(req.method==='GET'&&req.url==='/state')return send(200,{plan,phase,command});
 if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(403,{});
 let raw='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>32000000)return send(413,{});raw+=chunk.toString();}
 const body=JSON.parse(raw);
 if(req.url==='/reply'){
  if(typeof body.id!=='string'||!replies.has(body.id)||body.id!==command?.id)return send(409,{});
  const reply=replies.get(body.id)!;replies.delete(body.id);command=undefined;
  if(body.error)reply.reject(Error('Wallet declined or disconnected. Reconcile before retrying.'));
  else if(typeof body.value==='string'&&body.value.length<=32000000)reply.resolve(body.value);else reply.reject(Error('Wallet response rejected'));
  return send(200,{});
 }
 if(req.url==='/deploy'){
  if(busy)return send(409,{});
  if(typeof body.shieldedCoinPublicKey!=='string'||typeof body.shieldedEncryptionPublicKey!=='string')return send(400,{});
  busy=true;void deploy(body).catch(()=>{phase='Deployment did not finish. Inspect the private attempt record and reconcile on-chain state before retrying. No automatic retry will occur.';});return send(202,{});
 }
 return send(404,{});
 }catch{send(400,{});}
});
server.requestTimeout=30000;server.headersTimeout=10000;
server.listen(8788,'127.0.0.1',()=>console.log(`Private operator console: ${origin}/open/${session}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
