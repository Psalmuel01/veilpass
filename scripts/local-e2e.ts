import { execFileSync } from 'node:child_process';
import { browserAuthorization } from './browser-e2e.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { WebSocket } from 'ws';
import { Wait } from 'testcontainers';
import { logger as testkitLogger, getTestEnvironment, defaultContainersConfiguration, setContainersConfiguration, initializeMidnightProviders } from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import { Contract, ledger } from '../contracts/veilpass/managed/contract/index.js';
import { witnesses, fromHex, toHex, nullifier, type CredentialEnvelope, type PrivateState } from '../packages/credential/index.js';
import { memoryPrivateStateProvider } from '../packages/credential/memory-provider.js';

// Third-party wallet logs can contain secrets. Silence them; report only stages.
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
process.env.MN_TEST_ENVIRONMENT = 'undeployed';
testkitLogger.level = 'silent';
setNetworkId('undeployed');
setContainersConfiguration({ ...defaultContainersConfiguration, standalone: { ...defaultContainersConfiguration.standalone, fileName: 'compose.local.yaml', container: {
  proofServer: { name: 'veilpass-proof-server', port: 6300, waitStrategy: Wait.forListeningPorts().withStartupTimeout(180000) },
  node: { name: 'veilpass-node', port: 9944, waitStrategy: Wait.forHealthCheck().withStartupTimeout(180000) },
  indexer: { name: 'veilpass-indexer', port: 8088, waitStrategy: Wait.forHealthCheck().withStartupTimeout(180000) },
} } });
const env = getTestEnvironment(pino({ level: 'silent' }));
const batch: {valid: CredentialEnvelope; invalid: CredentialEnvelope} = JSON.parse(await readFile('.private/issuer-batch.json', 'utf8'));
const inputs = JSON.parse(await readFile('.private/deployment-inputs.json', 'utf8'));
const compiled = CompiledContract.make('veilpass', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets(path.resolve('contracts/veilpass/managed')));
try {
  console.log('Starting local Midnight network...');
  const config = await env.start();
  console.log('Synchronizing funded local wallet...');
  const wallet = await env.getMidnightWalletProvider();
  const providers = initializeMidnightProviders<'authorize', PrivateState>(wallet, config, { privateStateStoreName: 'veilpass-local', zkConfigPath: path.resolve('contracts/veilpass/managed') });
  providers.privateStateProvider = memoryPrivateStateProvider<PrivateState>();
  const proof = providers.proofProvider;
  providers.proofProvider = { async proveTx(tx, options) { console.log('Generating real proof...'); return proof.proveTx(tx, options); } };
  console.log('Deploying issuer root...');
  const deployed = await deployContract(providers, { compiledContract: compiled, privateStateId: 'holder', initialPrivateState: { envelope: batch.valid }, args: [fromHex(inputs.root), fromHex(inputs.issuer), fromHex(inputs.applicationId)] });
  const address = deployed.deployTxData.public.contractAddress;
  console.log('Deployment confirmed:', address);
  console.log('Authorizing valid credential...');
  const authorized = process.env.VEILPASS_BROWSER_E2E === '1'
    ? { public: await providers.publicDataProvider.watchForTxData(await browserAuthorization(wallet, config, address)) }
    : await deployed.callTx.authorize();
  if (authorized.public.status !== 'SucceedEntirely') throw new Error('Authorization transaction failed');
  const publicState = await providers.publicDataProvider.queryContractState(address);
  if (!publicState || !ledger(publicState.data).authorizations.member(nullifier(batch.valid))) throw new Error('Authorization missing');
  console.log('Authorization confirmed:', authorized.public.txId);
  const serialized = authorized.public.tx.serialize();
  const hex = toHex(serialized);
  for (const value of [batch.valid.credential.studentId, batch.valid.credential.subject, batch.valid.credential.degree]) {
    if (hex.includes(Buffer.from(value).toString('hex'))) throw new Error('Private text leaked into transaction');
  }
  if (hex.includes(batch.valid.credential.secret)) throw new Error('Credential secret leaked into transaction');
  await providers.privateStateProvider.set('holder', { envelope: batch.invalid });
  let invalidRejected = false;
  try { await deployed.callTx.authorize(); } catch { invalidRejected = true; }
  if (!invalidRejected) throw new Error('Invalid credential accepted');
  await providers.privateStateProvider.set('holder', { envelope: batch.valid });
  let replayRejected = false;
  try { await deployed.callTx.authorize(); } catch { replayRejected = true; }
  if (!replayRejected) throw new Error('Replay accepted');
  const evidence = { network: config.networkId, contractAddress: address, deployTxId: deployed.deployTxData.public.txId, authorizeTxId: authorized.public.txId, blockHeight: authorized.public.blockHeight, publicLedgerFields: Object.keys(ledger(publicState.data)), invalidRejected, replayRejected, privateTextAbsentFromSerializedTransaction: true, browserVerified: process.env.VEILPASS_BROWSER_E2E === '1', note: 'Local ephemeral network. Not a public preprod deployment. Byte scanning complements, but does not prove, full privacy.' };
  await mkdir('docs/evidence', { recursive: true });
  await writeFile('docs/evidence/local-e2e.json', JSON.stringify(evidence, null, 2));
  console.log('Real network E2E passed. Evidence: docs/evidence/local-e2e.json');
} catch (error) {
  const names = execFileSync('docker', ['ps','-a','--filter','name=veilpass-indexer_','--format','{{.Names}}'], {encoding:'utf8'}).trim().split('\n').filter(name => name && name !== 'veilpass-indexer_local');
  for (const name of names) {
    const logs = execFileSync('docker', ['logs','--tail','20',name], {encoding:'utf8',stdio:['ignore','pipe','pipe']});
    await writeFile('.private/indexer-failure.log', logs, {mode:0o600});
  }
  throw error;
} finally { await env.shutdown(); }
