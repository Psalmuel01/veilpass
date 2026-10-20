// SPDX-License-Identifier: Apache-2.0
/** Trusted, operator-configured Midnight indexer. Never accepts holder endpoints or state. */
import { ContractState } from '@midnight-ntwrk/compact-runtime';
import { Transaction, ContractCall, type AlignedValue } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { ledger, fromHex, toHex } from '../lifecycle/index';
import type { ChainAdapter, PublicSnapshot, ConfirmedAuthorization } from './index';
import { requestFromTranscript } from './transcript';
export { requestFromTranscript } from './transcript';
type Action = { __typename: string; address: string; state: string; entryPoint?: string };
type Block = { height: number; hash: string; timestamp: number;  };
type IndexedTransaction = { raw:string; identifiers: string[]; transactionResult: { status: string }; contractActions: Action[]; block: Block };
const fields = `__typename address state ... on ContractCall { entryPoint }`;
export type LifecycleVerifierKeys = Record<'authorize'|'revoke'|'deactivateIssuer', Uint8Array>;
type State = ReturnType<typeof ledger>;
export function snapshot(s: State, observedAt: number): PublicSnapshot {
  return { root: toHex(s.credentialRoot), domain: toHex(s.networkDomain), issuerActive: s.issuerActive, statusVersion: `${Number(s.leftRevoked)}:${Number(s.rightRevoked)}:${Number(s.issuerActive)}`, validFrom: Number(s.validFrom), validUntil: Number(s.validUntil), observedAt };
}
export class MidnightChainAdapter implements ChainAdapter {
  private readonly now: () => number;
  constructor(private readonly options: { indexerUrl: string; contractAddress: string; networkDomain: string; root: string; verifierKeys: LifecycleVerifierKeys; fetch?: typeof fetch; now?: () => number }) {
    for (const v of [options.contractAddress, options.networkDomain, options.root]) fromHex(v);
    if(!options.verifierKeys || Object.keys(options.verifierKeys).length!==3 || !(['authorize','revoke','deactivateIssuer'] as const).every(name=>options.verifierKeys[name] instanceof Uint8Array && options.verifierKeys[name].length>0)) throw new Error('Three pinned V2 verifier keys are required');
    const url = new URL(options.indexerUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid operator indexer URL');
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }
  private async query<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await (this.options.fetch ?? fetch)(this.options.indexerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }), cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Canonical indexer is unavailable');
    const body = await response.json();
    if (body.errors?.length || !body.data) throw new Error('Canonical indexer query failed');
    return body.data as T;
  }
  private state(encoded: string) {
    const full = ContractState.deserialize(Uint8Array.from(Buffer.from(encoded,'hex')));
    const operations=full.operations();
    if(operations.length!==3 || !Object.entries(this.options.verifierKeys).every(([name,key])=>{const operation=full.operation(name);return operation && Buffer.from(operation.verifierKey).equals(Buffer.from(key));})) throw new Error('Pinned contract verifier keys mismatch');
    const s = ledger(full.data);
    if (toHex(s.credentialRoot) !== this.options.root || toHex(s.networkDomain) !== this.options.networkDomain) throw new Error('Pinned deployment state mismatch');
    return s;
  }
  async currentState(): Promise<PublicSnapshot> {
    const data = await this.query<{ block: Block; contractAction: Action }>(`query($address: HexEncoded!) { block { height hash timestamp } contractAction(address: $address) { ${fields} } }`, { address: this.options.contractAddress });
    if (!data.block || data.contractAction?.address !== this.options.contractAddress) throw new Error('Canonical contract state unavailable');
    // Freshness is the indexed chain head time, not the wall clock of a stale server response.
    const timestamp = data.block.timestamp > 1e12 ? Math.floor(data.block.timestamp / 1000) : data.block.timestamp;
    if (!Number.isSafeInteger(timestamp) || timestamp > this.now() + 5) throw new Error('Invalid canonical head time');
    return snapshot(this.state(data.contractAction.state), Math.min(timestamp, this.now()));
  }
  async authorization(reference: string): Promise<ConfirmedAuthorization | null> {
    if(!/^00[0-9a-f]{64}$/.test(reference)) return null;
    const data = await this.query<{ transactions: IndexedTransaction[] }>(`query($offset: TransactionOffset!) { transactions(offset: $offset) { ... on RegularTransaction { raw identifiers transactionResult { status } } contractActions { ${fields} } block { height hash timestamp } } }`, { offset: { identifier: reference } });
    const matches = data.transactions.filter(tx => tx.identifiers?.includes(reference));
    if (matches.length !== 1) return null;
    const tx = matches[0];
    if (tx.transactionResult?.status !== 'SUCCESS') return null;
    const actions = tx.contractActions.filter(a => a.address === this.options.contractAddress);
    // Bounded MVP: reject ambiguous multiple calls to this contract in one transaction.
    if (actions.length !== 1 || actions[0].__typename !== 'ContractCall' || actions[0].entryPoint !== 'authorize') return null;
    const parsed=Transaction.deserialize('signature','proof','binding',Uint8Array.from(Buffer.from(tx.raw,'hex')));
    if(!parsed.identifiers().includes(reference))return null;
    const calls=[...(parsed.intents?.values() ?? [])].flatMap(intent=>intent.actions).filter((action):action is ContractCall<import('@midnight-ntwrk/midnight-js-protocol/ledger').Proof>=>action instanceof ContractCall && action.address===this.options.contractAddress);
    if(calls.length!==1 || calls[0].entryPoint!=='authorize')return null;
    const call=calls[0];
    const key=requestFromTranscript([...(call.guaranteedTranscript?.program ?? []),...(call.fallibleTranscript?.program ?? [])]);
    if(!key)return null;
    const after=this.state(actions[0].state);
    if(!after.consumed.member(fromHex(key)))return null;
    return { requestKey:key, contractAddress:this.options.contractAddress, snapshot:snapshot(after,this.now()),mode:'confirmed-midnight' };
  }
}
