import { readFileSync } from 'node:fs';
import { ContractState, valueToBigInt } from '@midnight-ntwrk/compact-runtime';
import { Transaction, ContractCall } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { describe, it, expect } from 'vitest';
import { toHex } from '../packages/lifecycle';
import { MidnightChainAdapter, requestFromTranscript } from '../packages/sdk/midnight-adapter';
const record=JSON.parse(readFileSync('tests/fixtures/lifecycle/confirmed.json','utf8'));
const verifierKeys={authorize:readFileSync('tests/fixtures/lifecycle/authorize.verifier'),revoke:readFileSync('tests/fixtures/lifecycle/revoke.verifier'),deactivateIssuer:readFileSync('tests/fixtures/lifecycle/deactivateIssuer.verifier')};
const now=Math.floor(record.transaction.block.timestamp/1000), reference=record.transaction.identifiers[0];
const parsed=Transaction.deserialize('signature','proof','binding',Buffer.from(record.transaction.raw,'hex'));
const call=[...parsed.intents!.values()].flatMap(i=>i.actions).find((a):a is ContractCall<import('@midnight-ntwrk/midnight-js-protocol/ledger').Proof>=>a instanceof ContractCall)!;
const program=[...(call.guaranteedTranscript?.program ?? []),...(call.fallibleTranscript?.program ?? [])];
const expected=requestFromTranscript(program)!;
function fixture(options: {status?:string;entryPoint?:string;timestamp?:number;failure?:boolean;mutate?:(tx:typeof record.transaction)=>void}={}) {
 const tx=structuredClone(record.transaction);
 tx.transactionResult.status=options.status ?? 'SUCCESS';tx.contractActions[0].entryPoint=options.entryPoint ?? 'authorize';options.mutate?.(tx);
 const fetcher:typeof fetch=async(_url,init)=>{if(options.failure)return Response.json({errors:[{message:'unavailable'}]});const {query}=JSON.parse(String(init?.body));return Response.json({data:query.includes('transactions(offset:')?{transactions:[tx]}:{block:{...tx.block,timestamp:options.timestamp ?? now},contractAction:tx.contractActions[0]}});};
 return new MidnightChainAdapter({indexerUrl:'http://localhost:8088/api/v3/graphql',contractAddress:record.address,networkDomain:record.domain,root:record.root,verifierKeys,fetch:fetcher,now:()=>now});
}
describe('confirmed Midnight adapter with captured public local-chain transaction',()=>{
 it('binds the exact typed request insertion from real serialized transaction data',async()=>{expect(expected).toMatch(/^[0-9a-f]{64}$/);expect(await fixture().authorization(reference)).toMatchObject({requestKey:expected,contractAddress:record.address,mode:'confirmed-midnight'});});
 it('rejects unknown references and unsuccessful or non-authorization calls',async()=>{expect(await fixture().authorization('00'+'ef'.repeat(32))).toBeNull();expect(await fixture({status:'PARTIAL_SUCCESS'}).authorization(reference)).toBeNull();expect(await fixture({entryPoint:'revoke'}).authorization(reference)).toBeNull();});
 it('rejects ambiguous calls, wrong addresses, and substituted raw transactions',async()=>{expect(await fixture({mutate:tx=>tx.contractActions.push(tx.contractActions[0])}).authorization(reference)).toBeNull();expect(await fixture({mutate:tx=>tx.contractActions[0].address='ff'.repeat(32)}).authorization(reference)).toBeNull();expect(await fixture({mutate:tx=>tx.identifiers=['00'+'ef'.repeat(32)]}).authorization('00'+'ef'.repeat(32))).toBeNull();});
 it('rejects a changed circuit verification key',async()=>{const f=fixture({mutate:tx=>{const s=ContractState.deserialize(Buffer.from(tx.contractActions[0].state,'hex'));s.setOperation('authorize',s.operation('revoke')!);tx.contractActions[0].state=toHex(s.serialize());}});await expect(f.authorization(reference)).rejects.toThrow('verifier keys');});
 it('rejects unsupported and malformed transaction reference formats',async()=>{expect(await fixture().authorization('cd'.repeat(32))).toBeNull();expect(await fixture().authorization('01'+'cd'.repeat(32))).toBeNull();});
 it('uses indexed head time and fails closed on indexer errors or future heads',async()=>{expect((await fixture({timestamp:now-90}).currentState()).observedAt).toBe(now-90);await expect(fixture({failure:true}).authorization(reference)).rejects.toThrow();await expect(fixture({timestamp:now+300}).currentState()).rejects.toThrow('head time');});
 it('pads the VM compact encoding of trailing zero bytes',()=>{const compact=structuredClone(program);for(let i=0;i<compact.length-1;i++){const op=compact[i];if(typeof op==='object' && 'idx' in op && op.idx.pushPath){const key=compact[i+1];if(typeof key==='object' && 'push' in key && key.push.value.tag==='cell')key.push.value.content.value=[new Uint8Array(31).fill(1)];}}expect(requestFromTranscript(compact)).toBe('01'.repeat(31)+'00');});
 it('rejects wrong map paths and ambiguous public transcripts',()=>{expect(requestFromTranscript([])).toBeNull();expect(requestFromTranscript([...program,...program])).toBeNull();const changed=structuredClone(program);for(const op of changed)if(typeof op==='object' && 'idx' in op && op.idx.pushPath && op.idx.path[0]?.tag==='value' && valueToBigInt(op.idx.path[0].value.value)===11n)op.idx.path[0].value.value=[new Uint8Array([10])];expect(requestFromTranscript(changed)).toBeNull();});
});
