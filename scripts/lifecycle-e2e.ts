import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { WebSocket } from 'ws';
import { logger as testkitLogger, LocalTestConfiguration, MidnightWalletProvider, initializeMidnightProviders } from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { Contract, ledger } from '../contracts/lifecycle/managed/contract/index.js';
import { witnesses, fromHex, toHex, label, requestKey, pureCircuits, type PrivateState } from '../packages/lifecycle/index.js';
import { sampleBatch } from '../packages/lifecycle/sample.js';
import { randomBytes } from 'node:crypto';
import { memoryPrivateStateProvider } from '../packages/credential/memory-provider.js';

// Third-party wallet logs can contain secrets. Silence them; report only stages.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
process.env.MN_TEST_ENVIRONMENT = 'undeployed';
testkitLogger.level = 'silent';
setNetworkId('undeployed');
const project = `veilpass-e2e-${process.pid}`;
const composeEnv = { ...process.env, TESTCONTAINERS_UID: String(process.pid) };
const compose = (...args: string[]) => execFileSync('docker', ['compose','-p',project,'-f','compose.local.yaml',...args], { env: composeEnv, encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:60000 });
let wallet: MidnightWalletProvider | undefined;
const batch = sampleBatch();
const compiled = CompiledContract.make('veilpass-lifecycle', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(path.resolve('contracts/lifecycle/managed')));
try {
  console.log('Preparing pinned Midnight runtime images (first run downloads public images)...');
  await mkdir('.cache/proof-server', { recursive: true });
  execFileSync('docker', ['compose','-p',project,'-f','compose.local.yaml','pull'], {env:composeEnv,stdio:'inherit',timeout:1800000});
  console.log('Starting local Midnight node, indexer and prover...');
  execFileSync('docker', ['compose','-p',project,'-f','compose.local.yaml','up','-d','--pull','never','--wait','--wait-timeout','180'], {env:composeEnv,stdio:'inherit',timeout:240000});
  const port = (service: string, internal: string) => Number(compose('port',service,internal).trim().split(':').pop());
  const config = new LocalTestConfiguration({node:port('node','9944'),indexer:port('indexer','8088'),proofServer:port('proof-server','6300')});
  let proofReady = false;
  for(let attempt=0;attempt<1200;attempt++) {
    try { if((await fetch(`${config.proofServer}/version`)).ok) { proofReady=true; break; } } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!proofReady) throw new Error('Local proof server did not become ready');
  console.log('Synchronizing funded local wallet...');
  wallet = await MidnightWalletProvider.build(pino({level:'silent'}),config,'0000000000000000000000000000000000000000000000000000000000000002');
  await wallet.start();
  const baseProviders = initializeMidnightProviders<'authorize' | 'revoke' | 'deactivateIssuer', PrivateState>(wallet, config, { privateStateStoreName: 'veilpass-local', zkConfigPath: path.resolve('contracts/lifecycle/managed') });
  const providers: typeof baseProviders = { ...baseProviders, privateStateProvider: memoryPrivateStateProvider<PrivateState>(), proofProvider: {
    async proveTx(tx, options) { console.log('Generating real proof...'); return baseProviders.proofProvider.proveTx(tx, options); }
  } };
  console.log('Deploying issuer root...');
  const deployed = await deployContract(providers, { compiledContract: compiled, privateStateId: 'holder', initialPrivateState: { envelope: batch.qualified, adminSecret: batch.adminSecret }, args: [fromHex(batch.qualified.root), label(batch.qualified.credential.issuer), pureCircuits.adminKey(fromHex(batch.adminSecret)), fromHex(batch.domain), fromHex(batch.appA), fromHex(batch.appB), BigInt(batch.qualified.credential.issuedAt), BigInt(batch.qualified.credential.expiresAt)] });
  const address = deployed.deployTxData.public.contractAddress;
  console.log('Deployment confirmed:', address);
  const transactions: string[] = [];
  for (const [app, policy] of [[batch.appA, 1n], [batch.appB, 2n]] as const) {
    const n = randomBytes(32).toString('hex'), deadline = Math.floor(Date.now()/1000) + 300;
    const accepted = await deployed.callTx.authorize(fromHex(app), policy, fromHex(n), BigInt(deadline));
    if (accepted.public.status !== 'SucceedEntirely') throw new Error('Authorization not confirmed');
    transactions.push(accepted.public.txId);
    const state = await providers.publicDataProvider.queryContractState(address);
    if (!state || !ledger(state.data).consumed.member(fromHex(requestKey(batch.domain,app,Number(policy) as 1|2,n,deadline)))) throw new Error('Request not in confirmed state');
    if (toHex(accepted.public.tx.serialize()).includes(batch.qualified.credential.holderSecret)) throw new Error('Holder secret leaked');
    let replay = false;
    try { await deployed.callTx.authorize(fromHex(app),policy,fromHex(n),BigInt(deadline)); }
    catch(error) { if(!String(error).includes('consumed')) throw error; replay=true; }
    if(!replay) throw new Error('Replay accepted');
  }
  const revoked = await deployed.callTx.revoke(false);
  if(revoked.public.status !== 'SucceedEntirely') throw new Error('Revocation not confirmed');
  for(const [app,policy] of [[batch.appA,1n],[batch.appB,2n]] as const) {
    let rejected=false;
    try { await deployed.callTx.authorize(fromHex(app),policy,randomBytes(32),BigInt(Math.floor(Date.now()/1000)+300)); }
    catch(error) { if(!String(error).includes('revoked')) throw error; rejected=true; }
    if(!rejected) throw new Error('Revoked qualification accepted');
  }
  const evidence={recordedAt:new Date().toISOString(),mode:'confirmed-midnight',network:config.networkId,contractAddress:address,deployTxId:deployed.deployTxData.public.txId,authorizeTxIds:transactions,revokeTxId:revoked.public.txId,twoPoliciesVerified:true,replayRejected:true,revocationRejectedByBothPolicies:true,note:'Ephemeral local network, not Preprod. No external adoption or cryptographic unlinkability claim.'};
  await mkdir('docs/evidence',{recursive:true});
  await writeFile('docs/evidence/lifecycle-network.json',JSON.stringify(evidence,null,2));
  console.log('V2 real-network lifecycle passed. Evidence: docs/evidence/lifecycle-network.json');
} finally {
  if(wallet) await wallet.stop();
  compose('down','--volumes');
}
