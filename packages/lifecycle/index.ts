// SPDX-License-Identifier: Apache-2.0
import { Contract, pureCircuits, type Qualification, type Witnesses } from '../../contracts/lifecycle/managed/contract/index.js';
export { ledger, pureCircuits } from '../../contracts/lifecycle/managed/contract/index.js';
export const toHex = (v: Uint8Array) => Array.from(v, b => b.toString(16).padStart(2, '0')).join('');
export function fromHex(v: string): Uint8Array {
  if (typeof v !== 'string' || !/^[0-9a-f]{64}$/.test(v)) throw new Error('Expected canonical lowercase 32-byte hex');
  return Uint8Array.from(v.match(/../g)!, b => parseInt(b, 16));
}
export function label(v: string) {
  const b = new TextEncoder().encode(v);
  if (!v || b.length > 32 || v.includes('\0')) throw new Error('Label must contain 1–32 UTF-8 bytes without NUL');
  const out = new Uint8Array(32); out.set(b); return out;
}
export interface QualificationEnvelope {
  version: 2;
  credential: { issuer: string; program: string; completed: boolean; level: number; issuedAt: number; expiresAt: number; holderSecret: string };
  sibling: string; isRight: boolean; root: string;
}
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Malformed credential');
  return v as Record<string, unknown>;
}
export function parseEnvelope(value: unknown): QualificationEnvelope {
  const e = record(value), c = record(e.credential);
  if (e.version !== 2 || typeof e.isRight !== 'boolean' || typeof c.completed !== 'boolean') throw new Error('Unsupported credential shape');
  for (const f of ['level', 'issuedAt', 'expiresAt']) if (!Number.isSafeInteger(c[f]) || (c[f] as number) < 0) throw new Error(`Invalid ${f}`);
  if ((c.level as number) > 255 || (c.issuedAt as number) >= (c.expiresAt as number)) throw new Error('Invalid credential interval or level');
  for (const f of ['issuer', 'program']) { if (typeof c[f] !== 'string') throw new Error(`Invalid ${f}`); label(c[f] as string); }
  fromHex(c.holderSecret as string); fromHex(e.sibling as string); fromHex(e.root as string);
  // Copy a bounded whitelist; ignore prototype/extraneous fields.
  return { version: 2, credential: { issuer: c.issuer as string, program: c.program as string, completed: c.completed, level: c.level as number, issuedAt: c.issuedAt as number, expiresAt: c.expiresAt as number, holderSecret: c.holderSecret as string }, sibling: e.sibling as string, root: e.root as string, isRight: e.isRight };
}
export function toCompact(input: QualificationEnvelope): Qualification {
  const { credential: c } = parseEnvelope(input);
  return { version: 2n, issuer: label(c.issuer), program: label(c.program), completed: c.completed, level: BigInt(c.level), issuedAt: BigInt(c.issuedAt), expiresAt: BigInt(c.expiresAt), holderSecret: fromHex(c.holderSecret) };
}
export interface PrivateState { envelope: QualificationEnvelope; adminSecret?: string }
export const witnesses: Witnesses<PrivateState> = {
  qualification: ({ privateState: s }) => [s, toCompact(s.envelope)],
  sibling: ({ privateState: s }) => [s, fromHex(s.envelope.sibling)],
  isRight: ({ privateState: s }) => [s, s.envelope.isRight],
  adminSecret: ({ privateState: s }) => { if (!s.adminSecret) throw new Error('Administrator secret required'); return [s, fromHex(s.adminSecret)]; },
};
export const contract = new Contract<PrivateState>(witnesses);
export function requestKey(domain: string, audience: string, policy: 1 | 2, nonce: string, deadline: number) {
  return toHex(pureCircuits.requestKey(fromHex(domain), fromHex(audience), BigInt(policy), fromHex(nonce), BigInt(deadline)));
}
