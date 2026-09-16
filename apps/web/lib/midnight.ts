import './bind-fetch';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js/contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js/network-id';
import { Transaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightBech32m, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import { Contract, ledger } from '../../../contracts/veilpass/managed/contract/index';
import { witnesses, fromHex, toHex, nullifier, type CredentialEnvelope, type PrivateState } from '../../../packages/credential/index';
import { memoryPrivateStateProvider } from '../../../packages/credential/memory-provider';

declare global { interface Window { midnight?: Record<string, InitialAPI> } }
export type Stage = 'preparing' | 'evaluating' | 'proving' | 'balancing' | 'submitting' | 'confirming' | 'confirmed';
export const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'preprod';
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
export function wallets() { return Object.entries(window.midnight ?? {}).filter(([, api]) => typeof api.connect === 'function'); }
export async function connectWallet(id: string) {
  const initial = window.midnight?.[id];
  if (!initial) throw new Error('Install a Midnight-compatible wallet, then refresh this page.');
  const api = await initial.connect(NETWORK);
  const config = await api.getConfiguration();
  if (config.networkId !== NETWORK) throw new Error(`Switch your wallet to ${NETWORK}.`);
  return api;
}
const compiled = CompiledContract.make('veilpass', Contract).pipe(CompiledContract.withWitnesses(witnesses), CompiledContract.withCompiledFileAssets('/zk'));
function decodeKey(value: string, kind: 'coin' | 'encryption') {
  if (/^[0-9a-f]{64}$/i.test(value)) return value;
  const encoded = MidnightBech32m.parse(value);
  return kind === 'coin' ? ShieldedCoinPublicKey.codec.decode(NETWORK, encoded).toHexString() : ShieldedEncryptionPublicKey.codec.decode(NETWORK, encoded).toHexString();
}
async function providers(api: ConnectedAPI, onStage: (stage: Stage) => void): Promise<MidnightProviders<'authorize', string, PrivateState>> {
  setNetworkId(NETWORK);
  const config = await api.getConfiguration();
  if (config.networkId !== NETWORK) throw new Error('Wallet network changed. Reconnect to the configured network.');
  const address = await api.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider<'authorize'>(`${window.location.origin}/zk`);
  const proverUrl = process.env.NEXT_PUBLIC_PROOF_SERVER || 'http://127.0.0.1:6300';
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(proverUrl).hostname)) throw new Error('A holder-controlled loopback proof server is required.');
  const proof = httpClientProofProvider(proverUrl, zkConfigProvider);
  return {
    zkConfigProvider,
    privateStateProvider: memoryPrivateStateProvider<PrivateState>(),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    proofProvider: { async proveTx(tx, options) { onStage('proving'); return proof.proveTx(tx, options); } },
    walletProvider: {
      getCoinPublicKey: () => decodeKey(address.shieldedCoinPublicKey, 'coin'),
      getEncryptionPublicKey: () => decodeKey(address.shieldedEncryptionPublicKey, 'encryption'),
      async balanceTx(tx) {
        onStage('balancing');
        const balanced = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize('signature', 'proof', 'binding', Uint8Array.from(balanced.tx.match(/../g) ?? [], b => parseInt(b, 16)));
      },
    },
    midnightProvider: { async submitTx(tx) {
      onStage('submitting'); await api.submitTransaction(toHex(tx.serialize()));
      onStage('confirming'); return tx.identifiers()[0];
    } },
  };
}
export async function prove(api: ConnectedAPI, envelope: CredentialEnvelope, address: string, onStage: (stage: Stage) => void) {
  if (!/^[0-9a-f]{64}$/i.test(address)) throw new Error('Deploy the issuer batch and configure its contract address first.');
  onStage('preparing');
  const p = await providers(api, onStage);
  const state = await p.publicDataProvider.queryContractState(address);
  if (!state) throw new Error('Contract not found on this network.');
  const publicState = ledger(state.data);
  if (toHex(publicState.credentialRoot) !== envelope.root || toHex(publicState.applicationId) !== envelope.applicationId) throw new Error('This credential belongs to a different issuer deployment.');
  onStage('evaluating');
  const instance = await findDeployedContract(p, { contractAddress: address, compiledContract: compiled, privateStateId: 'holder', initialPrivateState: { envelope } });
  const result = await instance.callTx.authorize();
  if (result.public.status !== 'SucceedEntirely') throw new Error('The network did not accept this authorization.');
  const confirmed = await p.publicDataProvider.queryContractState(address);
  if (!confirmed || !ledger(confirmed.data).authorizations.member(nullifier(envelope))) throw new Error('Authorization is not present in confirmed public state.');
  onStage('confirmed');
  return { txId: result.public.txId, blockHeight: result.public.blockHeight, nullifier: toHex(nullifier(envelope)), network: NETWORK, contractAddress: address };
}
export async function deploy(api: ConnectedAPI, envelope: CredentialEnvelope, onStage: (stage: Stage) => void) {
  onStage('preparing');
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Initialize the demo issuer before deployment.');
  const inputs = await response.json();
  const p = await providers(api, onStage);
  const result = await deployContract(p, { compiledContract: compiled, privateStateId: 'holder', initialPrivateState: { envelope }, args: [fromHex(inputs.root), fromHex(inputs.issuer), fromHex(inputs.applicationId)] });
  if (result.deployTxData.public.status !== 'SucceedEntirely') throw new Error('Deployment was not accepted by the network.');
  onStage('confirmed'); return result.deployTxData.public.contractAddress;
}
export { safeError } from './safe-error';
