// SPDX-License-Identifier: Apache-2.0
/** Developer-only generated-execution adapter. It is NOT a blockchain or ZK prover. */
import { randomBytes } from 'node:crypto';
import { contract, ledger, fromHex, toHex, requestKey } from './index';
import { sampleBatch, sampleContext, atTime } from './sample';
import { createVeilPassVerifier, policies, type ChainAdapter, type Challenge, type ChallengeStore, type ConfirmedAuthorization, type PolicyId, type PublicSnapshot } from '../sdk/index';
export class Workbench {
  readonly batch = sampleBatch();
  readonly address = randomBytes(32).toString('hex');
  private context = sampleContext(this.batch);
  private receipts = new Map<string, ConfirmedAuthorization>();
  private challenges = new Map<string, Challenge>();
  private now = () => Math.floor(Date.now() / 1000);
  constructor(private stores: Record<PolicyId, ChallengeStore>) {}
  snapshot(): PublicSnapshot {
    const s = ledger(this.context.currentQueryContext.state);
    return { root: toHex(s.credentialRoot), domain: toHex(s.networkDomain), issuerActive: s.issuerActive, statusVersion: `${Number(s.leftRevoked)}:${Number(s.rightRevoked)}:${Number(s.issuerActive)}`, validFrom: Number(s.validFrom), validUntil: Number(s.validUntil), observedAt: this.now() };
  }
  readonly chain: ChainAdapter = {
    authorization: async reference => this.receipts.get(reference) ?? null,
    currentState: async () => this.snapshot(),
  };
  verifier(policyId: PolicyId) {
    return createVeilPassVerifier({ audience: policyId === 'approved-training' ? this.batch.appA : this.batch.appB, networkDomain: this.batch.domain, contractAddress: this.address, policyId, store: this.stores[policyId], chain: this.chain, mode: 'generated-execution' });
  }
  async challenge(policy: PolicyId) {
    const c = await this.verifier(policy).createChallenge(); this.challenges.set(c.id, c); return c;
  }
  authorize(challengeId: string, basic = false) {
    const c = this.challenges.get(challengeId); if (!c) throw new Error('Unknown challenge');
    const start = performance.now();
    const ctx = atTime(this.context, this.now(), basic ? this.batch.basic : this.batch.qualified);
    const result = contract.impureCircuits.authorize(ctx, fromHex(c.audience), BigInt(policies[c.policyId]), fromHex(c.nonce), BigInt(c.expiresAt));
    this.context = result.context;
    const reference = randomBytes(32).toString('hex');
    this.receipts.set(reference, { requestKey: requestKey(c.networkDomain, c.audience, policies[c.policyId], c.nonce, c.expiresAt), contractAddress: this.address, snapshot: this.snapshot(), mode: 'generated-execution' });
    return { version: 2 as const, challengeId: c.id, transactionReference: reference, executionMs: performance.now() - start };
  }
  revoke(basic = false) {
    this.context = contract.impureCircuits.revoke(atTime(this.context, this.now()), basic).context;
  }
  deactivate() { this.context = contract.impureCircuits.deactivateIssuer(atTime(this.context, this.now())).context; }
  view() {
    return { mode: 'generated-execution', issuer: this.batch.qualified.credential.issuer, credential: { program: 'Developer training', level: 2, expiresAt: this.batch.qualified.credential.expiresAt }, state: this.snapshot(), requests: [...this.challenges.values()], authorizationCount: this.receipts.size };
  }
}
