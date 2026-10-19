// SPDX-License-Identifier: Apache-2.0
/** Explicit developer-controlled sample fixture; never production issuance. */
import { randomBytes } from 'node:crypto';
import { createConstructorContext, createCircuitContext, sampleContractAddress, type CircuitContext } from '@midnight-ntwrk/compact-runtime';
import { contract, pureCircuits, toCompact, toHex, fromHex, label, type PrivateState, type QualificationEnvelope } from './index';
export function sampleBatch(now = Math.floor(Date.now() / 1000)) {
  const make = (level: number): QualificationEnvelope => ({ version: 2, credential: { issuer: 'VeilPass Sample Academy', program: 'developer-training', completed: true, level, issuedAt: now - 60, expiresAt: now + 86400, holderSecret: randomBytes(32).toString('hex') }, sibling: '00'.repeat(32), isRight: level === 1, root: '00'.repeat(32) });
  const qualified = make(2), basic = make(1);
  const left = pureCircuits.credentialCommitment(toCompact(qualified)), right = pureCircuits.credentialCommitment(toCompact(basic));
  qualified.root = basic.root = toHex(pureCircuits.batchRoot(left, right));
  qualified.sibling = toHex(right); basic.sibling = toHex(left);
  return { qualified, basic, adminSecret: randomBytes(32).toString('hex'), domain: toHex(label('veilpass:local:v2')), appA: toHex(label('hackathon.example')), appB: toHex(label('community.example')) };
}
export type SampleBatch = ReturnType<typeof sampleBatch>;
export function sampleContext(batch: SampleBatch, envelope = batch.qualified, now = Math.floor(Date.now() / 1000)): CircuitContext<PrivateState> {
  const initial = contract.initialState(createConstructorContext({ envelope, adminSecret: batch.adminSecret }, '00'.repeat(32)), fromHex(envelope.root), label('VeilPass Sample Academy'), pureCircuits.adminKey(fromHex(batch.adminSecret)), fromHex(batch.domain), fromHex(batch.appA), fromHex(batch.appB), BigInt(batch.qualified.credential.issuedAt), BigInt(batch.qualified.credential.expiresAt));
  return createCircuitContext(sampleContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState, undefined, undefined, now);
}
export function atTime(ctx: CircuitContext<PrivateState>, now: number, envelope = ctx.currentPrivateState.envelope) {
  return createCircuitContext(ctx.currentQueryContext.address, ctx.currentZswapLocalState, ctx.currentQueryContext.state, { ...ctx.currentPrivateState, envelope }, undefined, undefined, now);
}
