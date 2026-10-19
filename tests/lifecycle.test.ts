import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { contract, ledger, fromHex, toHex, label, requestKey, pureCircuits, toCompact, parseEnvelope } from '../packages/lifecycle/index.js';
import { sampleBatch, sampleContext, atTime } from '../packages/lifecycle/sample.js';
const NOW = 1792368000;
const nonce = () => randomBytes(32).toString('hex');
function fixture() {
  const batch = sampleBatch(NOW), context = sampleContext(batch, batch.qualified, NOW);
  return { batch, context, authorize: (ctx = context, app = batch.appA, policy = 1n, n = nonce(), deadline = NOW + 120) => contract.impureCircuits.authorize(ctx, fromHex(app), policy, fromHex(n), BigInt(deadline)) };
}
describe('V2 generated Compact lifecycle constraints (not ZK proofs)', () => {
  it('reuses one credential across independent audience/policy domains', () => {
    const { batch, authorize } = fixture();
    const a = authorize(); const b = authorize(a.context, batch.appB, 2n);
    expect(ledger(b.context.currentQueryContext.state).consumed.size()).toBe(2n);
  });
  it('revokes irreversibly and rejects fresh verification for both applications', () => {
    const { batch, context, authorize } = fixture(); authorize();
    const revoked = contract.impureCircuits.revoke(context, false).context;
    expect(() => authorize(revoked)).toThrow(/revoked/);
    expect(() => authorize(revoked, batch.appB, 2n)).toThrow(/revoked/);
    const again = contract.impureCircuits.revoke(revoked, false).context;
    expect(ledger(again.currentQueryContext.state).leftRevoked).toBe(true);
    expect(Object.keys(contract.impureCircuits)).not.toContain('unrevoke');
  });
  it('does not revoke the other record', () => {
    const { batch, context, authorize } = fixture();
    const revoked = contract.impureCircuits.revoke(context, false).context;
    expect(() => authorize(atTime(revoked, NOW, batch.basic))).not.toThrow();
  });
  it('rejects unauthorized revocation and deactivation', () => {
    const { context } = fixture(); context.currentPrivateState.adminSecret = nonce();
    expect(() => contract.impureCircuits.revoke(context, false)).toThrow(/Unauthorized/);
    expect(() => contract.impureCircuits.deactivateIssuer(context)).toThrow(/Unauthorized/);
  });
  it('deactivates an issuer permanently', () => {
    const { context, authorize } = fixture();
    const stopped = contract.impureCircuits.deactivateIssuer(context).context;
    expect(() => authorize(stopped)).toThrow(/inactive/);
  });
  it.each(['issuer','program','holderSecret','level','completed','expiresAt'] as const)('rejects tampered %s', field => {
    const { context, authorize } = fixture();
    const c = context.currentPrivateState.envelope.credential;
    if (field === 'level') c.level = 3;
    else if (field === 'completed') c.completed = false;
    else if (field === 'expiresAt') c.expiresAt++;
    else if (field === 'holderSecret') c.holderSecret = nonce();
    else c[field] = 'forged';
    expect(() => authorize(context)).toThrow(/authenticity|approved/);
  });
  it('rejects a valid basic credential for the professional policy', () => {
    const { batch, context, authorize } = fixture();
    expect(() => authorize(atTime(context, NOW, batch.basic), batch.appB, 2n)).toThrow(/level too low/);
  });
  it('rejects wrong policies and audience substitution', () => {
    const { batch, context, authorize } = fixture();
    expect(() => authorize(context, batch.appB, 1n)).toThrow(/mismatch/);
    expect(() => authorize(context, batch.appA, 3n)).toThrow(/mismatch/);
  });
  it('uses ledger time for future, expiry and challenge boundaries', () => {
    const { batch, context, authorize } = fixture();
    expect(() => authorize(atTime(context, batch.qualified.credential.expiresAt))).toThrow(/Credential expired/);
    expect(() => authorize(atTime(context, batch.qualified.credential.issuedAt - 1))).toThrow(/not yet/);
    expect(() => authorize(context, batch.appA, 1n, nonce(), NOW)).toThrow(/Challenge expired/);
  });
  it('consumes the exact request once and supports fresh requests', () => {
    const { batch, context, authorize } = fixture(); const n = nonce();
    const result = authorize(context, batch.appA, 1n, n);
    expect(() => authorize(result.context, batch.appA, 1n, n)).toThrow(/consumed/);
    expect(() => authorize(result.context)).not.toThrow();
    const key = requestKey(batch.domain, batch.appA, 1, n, NOW + 120);
    expect(ledger(result.context.currentQueryContext.state).consumed.member(fromHex(key))).toBe(true);
  });
  it('binds domain, audience, policy, nonce and deadline in the canonical hash', () => {
    const { batch } = fixture(), n = nonce();
    const k = requestKey(batch.domain, batch.appA, 1, n, NOW + 120);
    for (const candidate of [requestKey(toHex(label('other-network')), batch.appA, 1, n, NOW + 120), requestKey(batch.domain, batch.appB, 1, n, NOW + 120), requestKey(batch.domain, batch.appA, 2, n, NOW + 120), requestKey(batch.domain, batch.appA, 1, nonce(), NOW + 120), requestKey(batch.domain, batch.appA, 1, n, NOW + 121)]) expect(candidate).not.toBe(k);
  });
  it('publishes no holder identifier, commitment or path in the authorization set', () => {
    const { batch, authorize } = fixture(); const result = authorize();
    const state = ledger(result.context.currentQueryContext.state);
    const publicHex = [...state.consumed].map(toHex).join('');
    expect(publicHex).not.toContain(batch.qualified.credential.holderSecret);
    expect(publicHex).not.toContain(toHex(pureCircuits.credentialCommitment(toCompact(batch.qualified))));
  });
  it('strictly validates imports and unambiguous encodings', () => {
    const b = sampleBatch(NOW); expect(parseEnvelope(b.qualified)).toEqual(b.qualified);
    expect(() => parseEnvelope(null)).toThrow();
    expect(() => parseEnvelope({ ...b.qualified, isRight: 'false' })).toThrow();
    expect(() => label('a\0')).toThrow();
    expect(() => fromHex('AB'.repeat(32))).toThrow();
  });
});
