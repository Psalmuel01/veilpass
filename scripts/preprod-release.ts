// Read-only acceptance of an already deployed contract. Never deploys or submits.
import './check-node.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { ledger } from '../integrations/issuance/managed-authorization/contract/index.js';
import { decodeWire, encodeWire } from '../integrations/issuance/src/wire.js';
import { hex } from '../integrations/issuance/src/crypto.js';
import { SignedMidnightAdapter } from '../integrations/issuance/src/midnight-adapter.js';
import type { SignedNetworkConfig } from '../apps/web/lib/signed-midnight.js';

const [envFile, configFile] = process.argv.slice(2);
if (!envFile || !configFile) throw Error('Usage: preprod-release <private-env-file> <deployment-config-file>');
process.loadEnvFile(envFile);
const config = decodeWire(await readFile(configFile,'utf8')) as SignedNetworkConfig;
if (config.network !== 'preprod') throw Error('Only Preprod is accepted');
for (const value of [config.contractAddress,config.domain,config.appA,config.appB])
  if (!/^[a-f0-9]{64}$/.test(value)) throw Error('Invalid deployment identifiers');
if (config.appA === config.appB) throw Error('Two distinct application audiences required');
const fingerprint = createHash('sha256').update(encodeWire(config.trust)).digest('hex');
if (!process.env.VEILPASS_ISSUER_FINGERPRINT || fingerprint !== process.env.VEILPASS_ISSUER_FINGERPRINT)
  throw Error('Deployment must pin the existing hosted issuer');
const token=process.env.BLOCKFROST_PROJECT_ID;
if (!token) throw Error('Existing Blockfrost Preprod project required');
const indexer=new URL('https://midnight-preprod.blockfrost.io/api/v0');indexer.searchParams.set('project_id',token);
const names=['authorize','publishStatus','deactivate'] as const;
const verifierKeys = Object.fromEntries(await Promise.all(names.map(async name=>[name,new Uint8Array(await readFile(`integrations/issuance/managed-authorization/keys/${name}.verifier`))]))) as Record<typeof names[number],Uint8Array>;
try {
  const adapter=new SignedMidnightAdapter({indexerUrl:indexer.href,contractAddress:config.contractAddress,networkDomain:config.domain,trust:config.trust,verifierKeys});
  const snapshot=await adapter.currentState();
  if (!snapshot.active || Date.now()/1000-snapshot.observedAt>120) throw Error('Inactive or stale deployment');
  const response=await fetch(indexer,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'query($address: HexEncoded!) { contractAction(address:$address) { state } }',variables:{address:config.contractAddress}}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!response.ok) throw Error();
  const body=await response.json();
  if (body.errors?.length || !body.data?.contractAction?.state) throw Error();
  const state=ledger(ContractState.deserialize(Uint8Array.from(Buffer.from(body.data.contractAction.state,'hex'))).data);
  if (hex(state.applicationA)!==config.appA || hex(state.applicationB)!==config.appB) throw Error('Application audience pins differ');
  const report={checkedAt:new Date().toISOString(),network:'preprod',contractAddress:config.contractAddress,issuerFingerprint:fingerprint,
    domain:config.domain,appA:config.appA,appB:config.appB,snapshot,
    verifierKeys:Object.fromEntries(names.map(name=>[name,createHash('sha256').update(verifierKeys[name]).digest('hex')])),
    deploymentPinsAccepted:true,chainSubmission:false,productionReady:false,
    note:'Deployed state/key acceptance only. Two real authorizations, replay and revocation acceptance, installed wallet, independent review and external pilot still require evidence.'};
  await writeFile('docs/evidence/preprod-release.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} catch { throw Error('Preprod deployed-state acceptance failed; check the contract, issuer, circuit keys, audiences and fresh indexer state. No release accepted.'); }
