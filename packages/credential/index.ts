import { Contract, pureCircuits, type Credential } from '../../contracts/veilpass/managed/contract/index.js';

export const POLICY_ID = 'GRADUATE_2020_V1';
export const ISSUER = 'Example University';
export type DemoCase = 'valid' | 'invalid';
export interface CredentialEnvelope {
  version: 1;
  credential: { schemaVersion: number; issuer: string; subject: string; degree: string; graduationYear: number; studentId: string; issuedAt: number; secret: string };
  sibling: string;
  isRight: boolean;
  root: string;
  applicationId: string;
}
export interface PrivateState { envelope: CredentialEnvelope }
export function bytes32(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length > 32) throw new Error('Credential field exceeds 32 bytes');
  const result = new Uint8Array(32); result.set(encoded); return result;
}
export const toHex = (value: Uint8Array) => Array.from(value, x => x.toString(16).padStart(2, '0')).join('');
export function fromHex(value: string): Uint8Array {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Expected a 32-byte hex value');
  return Uint8Array.from(value.match(/../g)!, v => parseInt(v, 16));
}
export function toCompact(envelope: CredentialEnvelope): Credential {
  const c = envelope.credential;
  if (envelope.version !== 1 || c.schemaVersion !== 1 || !Number.isInteger(c.graduationYear) || c.graduationYear < 0 || c.graduationYear > 65535 || !Number.isSafeInteger(c.issuedAt) || c.issuedAt < 0) throw new Error('Malformed credential');
  return { schemaVersion: BigInt(c.schemaVersion), issuer: bytes32(c.issuer), subject: bytes32(c.subject), degree: bytes32(c.degree), graduationYear: BigInt(c.graduationYear), studentId: bytes32(c.studentId), issuedAt: BigInt(c.issuedAt), secret: fromHex(c.secret) };
}
export const witnesses = {
  credential: ({ privateState }: { privateState: PrivateState }) => [privateState, toCompact(privateState.envelope)] as [PrivateState, Credential],
  sibling: ({ privateState }: { privateState: PrivateState }) => [privateState, fromHex(privateState.envelope.sibling)] as [PrivateState, Uint8Array],
  isRight: ({ privateState }: { privateState: PrivateState }) => [privateState, privateState.envelope.isRight] as [PrivateState, boolean],
};
export const contract = new Contract<PrivateState>(witnesses);
export function commitment(envelope: CredentialEnvelope) { return pureCircuits.credentialCommitment(toCompact(envelope)); }
export function nullifier(envelope: CredentialEnvelope) { return pureCircuits.authorizationNullifier(fromHex(envelope.credential.secret), fromHex(envelope.applicationId)); }
