// SPDX-License-Identifier: Apache-2.0
import {
  ecMulGenerator,
  type JubjubPoint,
} from "@midnight-ntwrk/compact-runtime";
import {
  JUBJUB_ORDER,
  seedBytesToJubjubSecretScalar,
  deriveJubjubPublicKeyFromSeed,
  normalizeScalar,
} from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
import {
  pureCircuits as core,
  type Proof,
  type VerificationMethodRef,
} from "@midnight-ntwrk/credential-compact";
export type PublicIdentity = {
  method: VerificationMethodRef;
  publicKey: JubjubPoint;
};
export const random32 = () => crypto.getRandomValues(new Uint8Array(32));
export const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
export function label(text: string) {
  const b = new TextEncoder().encode(text);
  if (!b.length || b.length > 32) throw new Error("Invalid 32-byte label");
  const out = new Uint8Array(32);
  out.set(b);
  return out;
}
export function sameBytes(a: Uint8Array, b: Uint8Array) {
  return (
    a instanceof Uint8Array && b instanceof Uint8Array && hex(a) === hex(b)
  );
}
export function samePoint(a: JubjubPoint, b: JubjubPoint) {
  return a.x === b.x && a.y === b.y;
}
export function sameMethod(a: VerificationMethodRef, b: VerificationMethodRef) {
  return (
    sameBytes(a.controllerAddress.bytes, b.controllerAddress.bytes) &&
    sameBytes(a.methodId, b.methodId)
  );
}
export function assertCanonicalProof(proof: Proof) {
  if (
    typeof proof.signature.s !== "bigint" ||
    proof.signature.s < 0n ||
    proof.signature.s >= JUBJUB_ORDER
  )
    throw new Error("Noncanonical signature");
}
export const clockSeconds = () => Math.floor(Date.now() / 1000);
export function checkedTime(clock: () => number) {
  const n = clock();
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("Invalid trusted clock");
  return n;
}
function nonceScalar() {
  for (;;) {
    const raw = random32();
    const n = BigInt("0x" + hex(raw));
    raw.fill(0);
    if (n > 0n && n < JUBJUB_ORDER) return n;
  }
}
export class LocalSigningKey {
  #seed: Uint8Array | undefined;
  #identity: PublicIdentity;
  constructor(seed?: Uint8Array, method?: VerificationMethodRef) {
    this.#seed = seed ? Uint8Array.from(seed) : random32();
    if (
      this.#seed.length !== 32 ||
      seedBytesToJubjubSecretScalar(this.#seed) === 0n
    )
      throw new Error("Invalid signing seed");
    this.#identity = {
      method: structuredClone(
        method || {
          controllerAddress: { bytes: random32() },
          methodId: random32(),
        },
      ),
      publicKey: deriveJubjubPublicKeyFromSeed(this.#seed),
    };
  }
  publicIdentity() {
    return structuredClone(this.#identity);
  }
  backupSeed() {
    if (!this.#seed) throw new Error("Holder is locked");
    return hex(this.#seed);
  }
  lock() {
    this.#seed?.fill(0);
    this.#seed = undefined;
  }
  sign(
    root: Uint8Array,
    context: "issuance" | "presentation",
    challenge: Uint8Array,
    now: number,
  ): Proof {
    if (!this.#seed) throw new Error("Holder is locked");
    const nonce = nonceScalar();
    const proof: Proof = {
      signerVerificationMethodRef: structuredClone(this.#identity.method),
      createdAt: BigInt(now),
      challengeHash: Uint8Array.from(challenge),
      publicKey: structuredClone(this.#identity.publicKey),
      signature: { r: ecMulGenerator(nonce), s: 0n },
    };
    // The official credential package owns the exact context/challenge derivation.
    // This adapter supplies a fresh CSPRNG nonce and the standard Schnorr response;
    // it must not use the DID payload-signing API, which hashes a different message.
    const challengeScalar =
      context === "issuance"
        ? core.issuanceProofChallenge(root, proof)
        : core.presentationProofChallenge(root, proof);
    proof.signature.s = normalizeScalar(
      nonce + challengeScalar * seedBytesToJubjubSecretScalar(this.#seed),
    );
    assertCanonicalProof(proof);
    return proof;
  }
}
