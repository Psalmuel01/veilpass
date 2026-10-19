import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
export function livePrivateRoot() { return existsSync(path.resolve(process.cwd(),'contracts/lifecycle')) ? path.resolve('.private') : path.resolve('../..','.private'); }
import { fromHex } from '../../../packages/lifecycle/index';
export interface LiveConfig { network: string; contractAddress: string; root: string; domain: string; appA: string; appB: string; indexerUri: string; indexerWsUri: string; proofServer: string }
export async function liveConfig(): Promise<LiveConfig> {
  const input = JSON.parse(await readFile(process.env.VEILPASS_LIVE_CONFIG || path.join(livePrivateRoot(),'lifecycle-public.json'), 'utf8')) as LiveConfig;
  for (const key of ['contractAddress','root','domain','appA','appB'] as const) fromHex(input[key]);
  if (!['undeployed','preprod'].includes(input.network)) throw new Error('Unsupported live network');
  for (const key of ['indexerUri','proofServer'] as const) {const url=new URL(input[key]);if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid public service URL');}
  const websocket=new URL(input.indexerWsUri);
  if (websocket.username || websocket.password || !['ws:','wss:'].includes(websocket.protocol)) throw new Error('Invalid indexer websocket URL');
  if (!['127.0.0.1','localhost','[::1]'].includes(new URL(input.proofServer).hostname)) throw new Error('Holder-controlled local prover required');
  return { network:input.network, contractAddress:input.contractAddress, root:input.root, domain:input.domain, appA:input.appA, appB:input.appB, indexerUri:input.indexerUri, indexerWsUri:input.indexerWsUri, proofServer:input.proofServer };
}
