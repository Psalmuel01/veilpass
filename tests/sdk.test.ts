import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Workbench } from '../packages/lifecycle/workbench.js';
import { FileChallengeStore } from '../packages/sdk/file-store.js';
import { createVeilPassVerifier, type ChallengeStore } from '../packages/sdk/index.js';
async function setup() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'veilpass-sdk-'));
  const stores = { 'approved-training': new FileChallengeStore(path.join(directory,'hackathon')), 'professional-level': new FileChallengeStore(path.join(directory,'community')) };
  const workbench = new Workbench(stores);
  return { directory, stores, workbench, close: () => rm(directory, { recursive: true, force: true }) };
}
describe('SDK integrates generated Compact state with durable verifier consumption', () => {
  it('verifies the same credential in two applications, then rejects new requests after revocation', async () => {
    const s = await setup();
    try {
      for (const policy of ['approved-training','professional-level'] as const) {
        const c = await s.workbench.challenge(policy), p = s.workbench.authorize(c.id);
        const result = await s.workbench.verifier(policy).verifyPresentation(p);
        expect(result).toMatchObject({ valid: true, eligible: true, mode: 'generated-execution' });
        expect(Object.keys(result).sort()).toEqual(['eligible','mode','policyId','valid','verificationReference']);
      }
      s.workbench.revoke();
      for (const policy of ['approved-training','professional-level'] as const) {
        const c = await s.workbench.challenge(policy);
        expect(() => s.workbench.authorize(c.id)).toThrow(/revoked/);
      }
    } finally { await s.close(); }
  });
  it('rejects an authorization generated before revocation', async () => {
    const s = await setup(); try {
      const c = await s.workbench.challenge('approved-training'), p = s.workbench.authorize(c.id);
      s.workbench.revoke();
      await expect(s.workbench.verifier('approved-training').verifyPresentation(p)).rejects.toMatchObject({code:'STATUS_CHANGED'});
    } finally { await s.close(); }
  });
  it('rejects verifier substitution, altered references and malformed versions', async () => {
    const s = await setup(); try {
      const a = await s.workbench.challenge('approved-training'), p = s.workbench.authorize(a.id);
      await expect(s.workbench.verifier('professional-level').verifyPresentation(p)).rejects.toMatchObject({code:'CHALLENGE'});
      const b = await s.workbench.challenge('approved-training');
      await expect(s.workbench.verifier('approved-training').verifyPresentation({...p, challengeId:b.id})).rejects.toMatchObject({code:'BINDING'});
      await expect(s.workbench.verifier('approved-training').verifyPresentation({...p,version:1})).rejects.toMatchObject({code:'MALFORMED'});
      await expect(s.workbench.verifier('approved-training').verifyPresentation({...p,transactionReference:'ff'.repeat(32)})).rejects.toMatchObject({code:'UNCONFIRMED'});
    } finally { await s.close(); }
  });
  it('consumes concurrently only once and preserves replay rejection across store instances', async () => {
    const s = await setup(); try {
      const c = await s.workbench.challenge('approved-training'), p = s.workbench.authorize(c.id);
      const results = await Promise.allSettled(Array.from({length:8}, () => s.workbench.verifier('approved-training').verifyPresentation(p)));
      expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      const restarted = new FileChallengeStore(path.join(s.directory,'hackathon'));
      expect(await restarted.get(c.id)).toEqual(c); expect(await restarted.consume(c.id)).toBe(false);
    } finally { await s.close(); }
  });
  it('fails closed for expiry, stale state and generated results in confirmed mode', async () => {
    const s = await setup(); try {
      const c = await s.workbench.challenge('approved-training'), p = s.workbench.authorize(c.id);
      const options = { audience:c.audience, networkDomain:c.networkDomain, contractAddress:c.contractAddress, policyId:c.policyId, store:s.stores[c.policyId], chain:s.workbench.chain };
      await expect(createVeilPassVerifier(options).verifyPresentation(p)).rejects.toMatchObject({code:'UNCONFIRMED'});
      await expect(createVeilPassVerifier({...options,mode:'generated-execution',now:()=>c.expiresAt}).verifyPresentation(p)).rejects.toMatchObject({code:'CHALLENGE_EXPIRED'});
      await expect(createVeilPassVerifier({...options,mode:'generated-execution',chain:{...s.workbench.chain,currentState:async()=>({...s.workbench.snapshot(),observedAt:0})}}).verifyPresentation(p)).rejects.toMatchObject({code:'STALE_STATE'});
    } finally { await s.close(); }
  });
  it('rejects traversal and unsupported policies', async () => {
    const s = await setup(); try {
      await expect(s.stores['approved-training'].get('../../secret')).rejects.toThrow();
      await expect(s.workbench.verifier('approved-training').createChallenge(301)).rejects.toMatchObject({code:'TTL'});
    } finally { await s.close(); }
  });
});
