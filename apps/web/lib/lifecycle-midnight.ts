import './bind-fetch';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightBech32m, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import { Contract } from '../../../contracts/lifecycle/managed/contract/index';
import { ledger, parseEnvelope, witnesses, fromHex, toHex, requestKey, type QualificationEnvelope, type PrivateState } from '../../../packages/lifecycle/index';
import { memoryPrivateStateProvider } from '../../../packages/credential/memory-provider';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import type { Challenge } from '../../../packages/sdk';
import type { LiveConfig } from './live-config';
import { wallets, type Stage } from './midnight';
export { wallets };
const compiled = CompiledContract.make('veilpass-lifecycle', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets('/zk-lifecycle'));
export async function connectLiveWallet(id: string, config: LiveConfig) {
  const initial = window.midnight?.[id]; if(!initial) throw new Error('Install a Midnight-compatible wallet, then refresh this page.');
  const api = await initial.connect(config.network);
  if ((await api.getConfiguration()).networkId !== config.network) throw new Error(`Switch your wallet to ${config.network}.`);
  return api;
}
export async function proveLifecycle(api: ConnectedAPI, input: QualificationEnvelope, config: LiveConfig, challenge: Challenge, onStage: (stage: Stage) => void) {
  onStage('preparing');
  const envelope = parseEnvelope(input);
  const policy = challenge.policyId === 'approved-training' ? 1 : challenge.policyId === 'professional-level' ? 2 : 0;
  if (!policy || challenge.version !== 2 || challenge.contractAddress !== config.contractAddress || challenge.networkDomain !== config.domain || challenge.audience !== (policy === 1 ? config.appA : config.appB) || challenge.expiresAt <= Date.now()/1000) throw new Error('Challenge context changed or expired. Request a fresh challenge.');
  if (envelope.root !== config.root) throw new Error('This credential belongs to a different issuer deployment.');
  const walletConfig = await api.getConfiguration();
  if (walletConfig.networkId !== config.network) throw new Error('Wallet network changed. Reconnect to the configured network.');
  if (!['localhost','127.0.0.1','[::1]'].includes(new URL(config.proofServer).hostname)) throw new Error('A holder-controlled loopback proof server is required.');
  setNetworkId(config.network);
  const addresses = await api.getShieldedAddresses();
  const decode = (value: string, coin: boolean) => /^[0-9a-f]{64}$/i.test(value) ? value : coin ? ShieldedCoinPublicKey.codec.decode(config.network,MidnightBech32m.parse(value)).toHexString() : ShieldedEncryptionPublicKey.codec.decode(config.network,MidnightBech32m.parse(value)).toHexString();
  const zkConfigProvider = new FetchZkConfigProvider<'authorize'|'revoke'|'deactivateIssuer'>(`${location.origin}/zk-lifecycle`);
  const proof = httpClientProofProvider(config.proofServer,zkConfigProvider);
  const providers: MidnightProviders<'authorize'|'revoke'|'deactivateIssuer',string,PrivateState> = {
    zkConfigProvider, privateStateProvider:memoryPrivateStateProvider<PrivateState>(),
    publicDataProvider:indexerPublicDataProvider(config.indexerUri,config.indexerWsUri),
    proofProvider:{async proveTx(tx,options) {onStage('proving'); return proof.proveTx(tx,options);}},
    walletProvider:{getCoinPublicKey:()=>decode(addresses.shieldedCoinPublicKey,true),getEncryptionPublicKey:()=>decode(addresses.shieldedEncryptionPublicKey,false),async balanceTx(tx) {onStage('balancing'); if((await api.getConfiguration()).networkId !== config.network) throw new Error('Wallet network changed. Reconnect to the configured network.'); const balanced=await api.balanceUnsealedTransaction(toHex(tx.serialize())); return Transaction.deserialize('signature','proof','binding',Uint8Array.from(balanced.tx.match(/../g) ?? [],b=>parseInt(b,16)));}},
    midnightProvider:{async submitTx(tx) {if((await api.getConfiguration()).networkId !== config.network) throw new Error('Wallet network changed. Reconnect to the configured network.'); onStage('submitting'); await api.submitTransaction(toHex(tx.serialize())); onStage('confirming');return tx.identifiers()[0];}},
  };
  const state = await providers.publicDataProvider.queryContractState(config.contractAddress);
  if(!state) throw new Error('Contract not found on this network.');
  const s = ledger(state.data);
  if(toHex(s.credentialRoot)!==config.root || toHex(s.networkDomain)!==config.domain) throw new Error('This credential belongs to a different issuer deployment.');
  onStage('evaluating');
  const instance = await findDeployedContract(providers,{contractAddress:config.contractAddress,compiledContract:compiled,privateStateId:'holder',initialPrivateState:{envelope}});
  const result = await instance.callTx.authorize(fromHex(challenge.audience),BigInt(policy),fromHex(challenge.nonce),BigInt(challenge.expiresAt));
  if(result.public.status !== 'SucceedEntirely') throw new Error('The network did not accept this authorization.');
  const confirmed = await providers.publicDataProvider.queryContractState(config.contractAddress);
  if(!confirmed || !ledger(confirmed.data).consumed.member(fromHex(requestKey(config.domain,challenge.audience,policy,challenge.nonce,challenge.expiresAt)))) throw new Error('Authorization is not present in confirmed public state.');
  onStage('confirmed');
  return {version:2 as const,challengeId:challenge.id,transactionReference:result.public.txId,blockHeight:result.public.blockHeight};
}
