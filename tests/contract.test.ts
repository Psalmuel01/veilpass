import { pureCircuits } from '../contracts/veilpass/managed/contract/index.js';
import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createConstructorContext, createCircuitContext, sampleContractAddress } from '@midnight-ntwrk/compact-runtime';
import { ledger } from '../contracts/veilpass/managed/contract/index.js';
import { contract, bytes32, commitment, toHex, fromHex, nullifier, type CredentialEnvelope } from '../packages/credential/index.js';

function batch(issuer = 'Example University') {
  const make = (year: number): CredentialEnvelope => ({ version: 1, credential: { schemaVersion: 1, issuer, subject: 'private-holder-123', degree: 'Computer Science', graduationYear: year, studentId: 'STUDENT-SECRET-12345', issuedAt: 1780000000, secret: randomBytes(32).toString('hex') }, sibling: '00'.repeat(32), isRight: year === 2018, root: '', applicationId: toHex(bytes32('test-app')) });
  const valid = make(2024), invalid = make(2018);
  const left = commitment(valid), right = commitment(invalid);
  valid.root = invalid.root = toHex(pureCircuits.batchRoot(left, right));
  valid.sibling = toHex(right); invalid.sibling = toHex(left);
  return { valid, invalid };
}
function context(envelope: CredentialEnvelope, root = envelope.root) {
  const initial = contract.initialState(createConstructorContext({ envelope }, '00'.repeat(32)), fromHex(root), bytes32('Example University'), fromHex(envelope.applicationId));
  return createCircuitContext(sampleContractAddress(), initial.currentZswapLocalState, initial.currentContractState, initial.currentPrivateState);
}
describe('compiled Compact authorization', () => {
  it('accepts an authentic approved 2024 credential', () => {
    const { valid } = batch();
    const result = contract.impureCircuits.authorize(context(valid));
    expect(ledger(result.context.currentQueryContext.state).authorizations.member(nullifier(valid))).toBe(true);
  });
  it('rejects an authentic 2018 credential', () => {
    const { invalid } = batch();
    expect(() => contract.impureCircuits.authorize(context(invalid))).toThrow(/does not satisfy/);
  });
  it('rejects an unapproved issuer even if committed in the batch', () => {
    const { valid } = batch('Untrusted University');
    expect(() => contract.impureCircuits.authorize(context(valid))).toThrow(/not approved/);
  });
  it('rejects an edited graduation year', () => {
    const { invalid } = batch(); invalid.credential.graduationYear = 2024;
    expect(() => contract.impureCircuits.authorize(context(invalid))).toThrow(/authenticity/);
  });
  it.each(['subject', 'degree', 'studentId'] as const)('binds %s to issuer commitment', field => {
    const { valid } = batch(); valid.credential[field] = 'forged';
    expect(() => contract.impureCircuits.authorize(context(valid))).toThrow(/authenticity/);
  });
  it('rejects forged private secrets and membership paths', () => {
    const { valid } = batch(); valid.credential.secret = toHex(bytes32('forged'));
    expect(() => contract.impureCircuits.authorize(context(valid))).toThrow(/authenticity/);
    const other = batch().valid; other.isRight = true;
    expect(() => contract.impureCircuits.authorize(context(other))).toThrow(/authenticity/);
  });
  it('rejects replay without changing authorization state', () => {
    const { valid } = batch(); const result = contract.impureCircuits.authorize(context(valid));
    expect(() => contract.impureCircuits.authorize(result.context)).toThrow(/already authorized/);
  });
  it('rejects unsupported schemas and malformed year', () => {
    const { valid } = batch(); valid.credential.schemaVersion = 2;
    expect(() => contract.impureCircuits.authorize(context(valid))).toThrow(/Malformed/);
    valid.credential.schemaVersion = 1; valid.credential.graduationYear = -1;
    expect(() => contract.impureCircuits.authorize(context(valid))).toThrow(/Malformed/);
  });
  it('only exposes the root, issuer, application scope and nullifier set in ledger', () => {
    const { valid } = batch(); const result = contract.impureCircuits.authorize(context(valid));
    const state = ledger(result.context.currentQueryContext.state);
    expect(Object.keys(state).sort()).toEqual(['applicationId', 'approvedIssuer', 'authorizations', 'credentialRoot']);
    const encoded = JSON.stringify(state, (_, value) => typeof value === 'bigint' ? value.toString() : value);
    expect(encoded).not.toContain(valid.credential.studentId);
    expect(encoded).not.toContain(valid.credential.subject);
    expect(encoded).not.toContain(valid.credential.secret);
    expect(encoded).not.toContain('graduationYear');
  });
  it('scopes nullifiers to the application', () => {
    const { valid } = batch(); const first = toHex(nullifier(valid));
    valid.applicationId = toHex(bytes32('other-app')); expect(toHex(nullifier(valid))).not.toBe(first);
  });
});
