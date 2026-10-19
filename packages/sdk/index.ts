// SPDX-License-Identifier: Apache-2.0
/** Server-side verifier SDK. No private credential or witness is accepted here. */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { requestKey, fromHex } from '../lifecycle/index';
export type PolicyId = 'approved-training' | 'professional-level';
export const policies = { 'approved-training': 1, 'professional-level': 2 } as const;
export type Mode = 'confirmed-midnight' | 'generated-execution';
export class VeilPassError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'VeilPassError'; }
}
export interface Challenge { version: 2; id: string; nonce: string; policyId: PolicyId; audience: string; networkDomain: string; contractAddress: string; issuedAt: number; expiresAt: number }
export interface ChallengeStore {
  put(c: Challenge): Promise<void>;
  get(id: string): Promise<Challenge | null>;
  /** Must atomically mark once, persist before success, and return false on replay. */
  consume(id: string): Promise<boolean>;
}
export interface PublicSnapshot { root: string; domain: string; issuerActive: boolean; statusVersion: string; validFrom: number; validUntil: number; observedAt: number }
export interface ConfirmedAuthorization { requestKey: string; contractAddress: string; snapshot: PublicSnapshot; mode: Mode }
export interface ChainAdapter {
  /** Authenticate a successful finalized authorize transaction and its exact public inputs. Never trust holder-supplied fields. */
  authorization(reference: string): Promise<ConfirmedAuthorization | null>;
  /** Read the current canonical state of the configured contract, not a cached holder snapshot. */
  currentState(): Promise<PublicSnapshot>;
}
export interface Presentation { version: 2; challengeId: string; transactionReference: string }
export interface VerifierOptions {
  audience: string; networkDomain: string; contractAddress: string; policyId: PolicyId;
  store: ChallengeStore; chain: ChainAdapter; mode?: Mode; now?: () => number; maxStateAgeSeconds?: number;
}
const fail = (code: string, message: string): never => { throw new VeilPassError(code, message); };
const eq = (a: string, b: string) => { try { return timingSafeEqual(fromHex(a), fromHex(b)); } catch { return false; } };
export function createVeilPassVerifier(options: VerifierOptions) {
  const o = options, mode = o.mode ?? 'confirmed-midnight', now = o.now ?? (() => Math.floor(Date.now() / 1000));
  fromHex(o.audience); fromHex(o.networkDomain); fromHex(o.contractAddress);
  if (!Object.hasOwn(policies, o.policyId)) fail('POLICY', 'Unsupported policy');
  const maxAge = o.maxStateAgeSeconds ?? 30;
  if (!Number.isSafeInteger(maxAge) || maxAge < 0 || maxAge > 60) fail('CONFIG', 'State age must be 0–60 seconds');
  function fresh(s: PublicSnapshot, t: number) {
    if (!s || typeof s.issuerActive !== "boolean" || typeof s.statusVersion !== "string" || !/^[01]:[01]:[01]$/.test(s.statusVersion) || ![s.validFrom,s.validUntil].every(v=>Number.isSafeInteger(v)&&v>=0) || s.validFrom >= s.validUntil || !eq(s.root,s.root)) fail("INVALID_STATE", "Malformed canonical public state");
    if (!Number.isSafeInteger(s.observedAt) || s.observedAt > t || t - s.observedAt > maxAge) fail('STALE_STATE', 'Current canonical state is unavailable');
    if (!s.issuerActive) fail('ISSUER_INACTIVE', 'Issuer is inactive');
    if (t < s.validFrom || t >= s.validUntil) fail('EXPIRED', 'Credential batch is outside its validity interval');
    if (!eq(s.domain, o.networkDomain)) fail('DOMAIN', 'Network domain mismatch');
  }
  return {
    async createChallenge(ttlSeconds = 120): Promise<Challenge> {
      if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300) fail('TTL', 'Challenge lifetime must be 1–300 seconds');
      const t = now();
      const c: Challenge = { version: 2, id: randomBytes(32).toString('hex'), nonce: randomBytes(32).toString('hex'), policyId: o.policyId, audience: o.audience, networkDomain: o.networkDomain, contractAddress: o.contractAddress, issuedAt: t, expiresAt: t + ttlSeconds };
      await o.store.put(c); return c;
    },
    async verifyPresentation(value: unknown) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('MALFORMED', 'Presentation must be an object');
      const p = value as Presentation;
      if (p.version !== 2 || typeof p.challengeId !== 'string' || !/^[0-9a-f]{64}$/.test(p.challengeId) || typeof p.transactionReference !== 'string' || !/^(?:00)?[0-9a-f]{64}$/.test(p.transactionReference)) fail('MALFORMED', 'Incompatible presentation');
      const c = await o.store.get(p.challengeId);
      if (!c) return fail('CHALLENGE', 'Unknown challenge');
      if (c.version !== 2 || c.policyId !== o.policyId || !eq(c.audience, o.audience) || !eq(c.networkDomain, o.networkDomain) || !eq(c.contractAddress, o.contractAddress)) fail('CONTEXT', 'Challenge belongs to another verifier, policy or network');
      let t = now();
      if (t < c.issuedAt || t >= c.expiresAt) fail('CHALLENGE_EXPIRED', 'Challenge expired');
      const auth = await o.chain.authorization(p.transactionReference);
      if (!auth || auth.mode !== mode || !eq(auth.contractAddress, o.contractAddress)) return fail('UNCONFIRMED', 'No accepted authorization in the required execution mode');
      const expected = requestKey(c.networkDomain, c.audience, policies[c.policyId], c.nonce, c.expiresAt);
      if (!eq(auth.requestKey, expected)) fail('BINDING', 'Authorization does not match the requested context');
      const current = await o.chain.currentState();
      t = now(); fresh(current, t);
      if (t >= c.expiresAt) fail('CHALLENGE_EXPIRED', 'Challenge expired during verification');
      // Conservative: any batch revocation invalidates all pre-change receipts.
      if (current.statusVersion !== auth.snapshot.statusVersion || !eq(current.root, auth.snapshot.root)) fail('STATUS_CHANGED', 'Credential status changed; generate a fresh authorization');
      if (!await o.store.consume(c.id)) fail('REPLAY', 'Challenge already consumed');
      return { valid: true as const, eligible: true as const, policyId: c.policyId, verificationReference: p.transactionReference, mode };
    },
  };
}
