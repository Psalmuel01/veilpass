// SPDX-License-Identifier: Apache-2.0
import { defineCredentialFamily } from "@midnight-ntwrk/credential-model";
import {
  pureCircuits as core,
  type Proof,
  type VerificationMethodRef,
} from "@midnight-ntwrk/credential-compact";
import {
  pureCircuits as family,
  type QualificationClaims,
  type Enrollment,
} from "../managed/contract/index.js";
import {
  LocalSigningKey,
  type PublicIdentity,
  random32,
  hex,
  label,
  sameBytes,
  samePoint,
  sameMethod,
  assertCanonicalProof,
  checkedTime,
  clockSeconds,
} from "./crypto.js";
import { encryptBackup, decryptBackup } from "./backup.js";
import { encodeWire, decodeWire } from "./wire.js";
export { encodeWire, decodeWire } from "./wire.js";
export type Credential = Parameters<typeof family.credentialRoot>[0];
export type Presentation = Parameters<typeof family.presentationRoot>[0];
export type SignedQualification = {
  credential: Credential;
  claims: QualificationClaims;
  proof: Proof;
};
export type IssuerTrust = PublicIdentity & { registryId: Uint8Array };
export type Offer = {
  challenge: Uint8Array;
  expiresAt: bigint;
  issuer: IssuerTrust;
};
export type EnrollmentRequest = { context: Enrollment; proof: Proof };
export type Challenge = Omit<Presentation["disclosed"], "credentialRoot">;
export type PresentationWitness = {
  qualification: SignedQualification;
  presentation: Presentation;
  proof: Proof;
};
export type IssuedStatus = {
  active: boolean;
  revoked: boolean;
  credentialRoot: Uint8Array;
};
export type StatusReader = {
  trust: IssuerTrust;
  read: (id: string) => IssuedStatus | undefined;
};
export const qualificationFamily = defineCredentialFamily({
  id: "veilpass:qualification",
  version: "1.0.0",
  name: "VeilPass developer qualification",
  schema: {
    id: "developer-training",
    version: "1.0.0",
    credentialTypes: ["DeveloperQualification"],
    claims: [
      {
        id: "program",
        path: ["claims", "program"],
        disclosure: "predicate-only",
        required: true,
      },
      {
        id: "completed",
        path: ["claims", "completed"],
        disclosure: "predicate-only",
        required: true,
      },
      {
        id: "level",
        path: ["claims", "level"],
        disclosure: "predicate-only",
        required: true,
      },
      {
        id: "holderPublicKey",
        path: ["claims", "holderPublicKey"],
        disclosure: "committed",
        required: true,
      },
    ],
  },
});
export const credentialId = (q: SignedQualification) =>
  hex(q.credential.statusBinding.statusHandleCommitment);
function validCredential(q: SignedQualification, trust: IssuerTrust) {
  assertCanonicalProof(q.proof);
  family.verifyQualification(
    q.credential,
    q.claims,
    q.proof,
    trust.method,
    trust.publicKey,
  );
  if (
    !sameBytes(
      q.credential.statusBinding.registryRef.registryId,
      trust.registryId,
    ) ||
    !sameMethod(
      q.credential.statusBinding.registryRef.authorityVerificationMethodRef,
      trust.method,
    )
  )
    throw new Error("Untrusted status registry");
}
function assertSeconds(value: number, max: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max)
    throw new Error("Invalid duration");
}

/** Trusted local issuer operator. No public issuance or administration endpoint. */
export class IssuerAuthority {
  #key = new LocalSigningKey();
  #registryId = random32();
  #active = true;
  #offers = new Map<
    string,
    {
      level: 1 | 2;
      createdAt: number;
      expiresAt: number;
      holder?: PublicIdentity;
    }
  >();
  #issued = new Map<string, { revoked: boolean; credentialRoot: Uint8Array }>();
  #completed = new Map<
    string,
    { root: Uint8Array; qualification: SignedQualification; until: number }
  >();
  constructor(
    private clock: () => number = clockSeconds,
    private lifetime = 86400,
  ) {
    assertSeconds(lifetime, 31536000);
  }
  publicTrust(): IssuerTrust {
    return {
      ...this.#key.publicIdentity(),
      registryId: Uint8Array.from(this.#registryId),
    };
  }
  /** The operator approves these claims; the applicant cannot choose the level. */
  approve(level: 1 | 2, holder?: PublicIdentity): Offer {
    if (!this.#active) throw new Error("Issuer inactive");
    if (holder) {
      core.assertValidVerificationMethodRef(holder.method);
      if (
        typeof holder.publicKey.x !== "bigint" ||
        typeof holder.publicKey.y !== "bigint"
      )
        throw new Error("Invalid holder public key");
    }
    if (level !== 1 && level !== 2)
      throw new Error("Unsupported qualification level");
    const now = checkedTime(this.clock);
    for (const [id, o] of this.#offers)
      if (o.expiresAt <= now) this.#offers.delete(id);
    if (this.#offers.size >= 128)
      throw new Error("Pending issuance limit reached");
    const challenge = random32();
    this.#offers.set(hex(challenge), {
      level,
      createdAt: now,
      expiresAt: now + 300,
      ...(holder ? { holder: structuredClone(holder) } : {}),
    });
    return {
      challenge,
      expiresAt: BigInt(now + 300),
      issuer: this.publicTrust(),
    };
  }
  issue(request: EnrollmentRequest): SignedQualification {
    if (this.#issued.size >= 2048)
      throw new Error("Issuer storage capacity reached");
    const now = checkedTime(this.clock),
      offer = this.#offers.get(hex(request.context.challenge)),
      trust = this.publicTrust();
    if (!this.#active) throw new Error("Issuer inactive");
    if (!offer) throw new Error("Issuance request not pending");
    if (now >= offer.expiresAt) throw new Error("Issuance request expired");
    if (
      offer.holder &&
      (!sameMethod(offer.holder.method, request.context.holder) ||
        !samePoint(offer.holder.publicKey, request.context.holderPublicKey))
    )
      throw new Error("Enrollment not approved for this holder");
    if (
      !sameMethod(request.context.issuer, trust.method) ||
      request.context.expiresAt !== BigInt(offer.expiresAt)
    )
      throw new Error("Wrong issuance context");
    if (
      !sameMethod(
        request.context.holder,
        request.proof.signerVerificationMethodRef,
      ) ||
      !samePoint(request.context.holderPublicKey, request.proof.publicKey) ||
      !sameBytes(request.context.challenge, request.proof.challengeHash)
    )
      throw new Error("Enrollment holder mismatch");
    if (
      request.proof.createdAt < BigInt(offer.createdAt) ||
      request.proof.createdAt > BigInt(now)
    )
      throw new Error("Enrollment time invalid");
    assertCanonicalProof(request.proof);
    core.assertValidPresentationContextProof(
      family.enrollmentRoot(request.context),
      request.proof,
    );
    const claims: QualificationClaims = {
      program: label("developer-training"),
      completed: true,
      level: BigInt(offer.level),
      holderPublicKey: structuredClone(request.context.holderPublicKey),
    };
    const credential: Credential = {
      version: 1n,
      schema: {
        packageId: label("veilpass:qualification"),
        schemaId: label("developer-training"),
        majorVersion: 1n,
        minorVersion: 0n,
      },
      issuerVerificationMethodRef: trust.method,
      holderBinding: {
        holderVerificationMethodRef: structuredClone(request.context.holder),
      },
      statusBinding: {
        registryRef: {
          registryId: trust.registryId,
          authorityVerificationMethodRef: trust.method,
        },
        statusHandleCommitment: random32(),
      },
      issuedAt: BigInt(now),
      hasExpiration: true,
      expiresAt: BigInt(now + this.lifetime),
      claims: {},
      claimCommitments: {},
      claimRoot: family.claimsRoot(claims),
    };
    const root = family.credentialRoot(credential),
      proof = this.#key.sign(root, "issuance", request.context.challenge, now);
    const signed = { credential, claims, proof };
    validCredential(signed, trust);
    this.#issued.set(credentialId(signed), {
      revoked: false,
      credentialRoot: Uint8Array.from(root),
    });
    this.#offers.delete(hex(request.context.challenge));
    return structuredClone(signed);
  }
  revoke(id: string) {
    const state = this.#issued.get(id);
    if (!state) throw new Error("Unknown credential");
    state.revoked = true;
  }
  /** Transport retry: a fresh valid proof for the same enrollment returns the
   * same credential for ten minutes, without issuing a second status record. */
  issueOrResume(request: EnrollmentRequest): SignedQualification {
    const now = checkedTime(this.clock);
    for (const [id, value] of this.#completed)
      if (value.until <= now) this.#completed.delete(id);
    const id = hex(request.context.challenge),
      completed = this.#completed.get(id);
    if (!this.#active) throw new Error("Issuer inactive");
    if (completed) {
      if (
        !sameBytes(completed.root, family.enrollmentRoot(request.context)) ||
        !samePoint(request.proof.publicKey, request.context.holderPublicKey) ||
        !sameMethod(
          request.proof.signerVerificationMethodRef,
          request.context.holder,
        ) ||
        !sameBytes(request.proof.challengeHash, request.context.challenge) ||
        request.proof.createdAt > BigInt(now)
      )
        throw new Error("Wrong retry context");
      assertCanonicalProof(request.proof);
      core.assertValidPresentationContextProof(completed.root, request.proof);
      if (this.#issued.get(credentialId(completed.qualification))?.revoked)
        throw new Error("Credential revoked");
      return structuredClone(completed.qualification);
    }
    if (this.#completed.size >= 128)
      throw new Error("Issuance retry capacity reached");
    const qualification = this.issue(request);
    this.#completed.set(id, {
      root: family.enrollmentRoot(request.context),
      qualification: structuredClone(qualification),
      until: now + 600,
    });
    return qualification;
  }
  deactivate() {
    this.#active = false;
  }
  statusEntries() {
    return [...this.#issued].map(([id, state]) => ({
      id,
      revoked: state.revoked,
      credentialRoot: Uint8Array.from(state.credentialRoot),
    }));
  }
  /** Sensitive state: encrypt before storage; never expose over HTTP. */
  exportState() {
    return encodeWire({
      version: 1,
      purpose: "veilpass:issuer-state:v1",
      seed: this.#key.backupSeed(),
      identity: this.#key.publicIdentity(),
      registryId: this.#registryId,
      active: this.#active,
      lifetime: this.lifetime,
      offers: [...this.#offers],
      issued: [...this.#issued],
      completed: [...this.#completed],
    });
  }
  static fromState(text: string, clock: () => number = clockSeconds) {
    const data = decodeWire(text) as {
      version: number;
      purpose: string;
      seed: string;
      identity: PublicIdentity;
      registryId: Uint8Array;
      active: boolean;
      lifetime: number;
      offers: [
        string,
        {
          level: 1 | 2;
          createdAt: number;
          expiresAt: number;
          holder?: PublicIdentity;
        },
      ][];
      issued: [string, { revoked: boolean; credentialRoot: Uint8Array }][];
      completed?: [
        string,
        { root: Uint8Array; qualification: SignedQualification; until: number },
      ][];
    };
    if (
      data.version !== 1 ||
      data.purpose !== "veilpass:issuer-state:v1" ||
      !/^[0-9a-f]{64}$/.test(data.seed) ||
      !(data.registryId instanceof Uint8Array) ||
      data.registryId.length !== 32 ||
      typeof data.active !== "boolean" ||
      !Array.isArray(data.offers) ||
      data.offers.length > 128 ||
      !Array.isArray(data.issued)
    )
      throw new Error("Invalid issuer state");
    const issuer = new IssuerAuthority(clock, data.lifetime);
    issuer.#key.lock();
    const seed = Uint8Array.from(data.seed.match(/../g) || [], (n) =>
      parseInt(n, 16),
    );
    try {
      issuer.#key = new LocalSigningKey(seed, data.identity.method);
    } finally {
      seed.fill(0);
    }
    core.assertValidVerificationMethodRef(data.identity.method);
    if (
      !samePoint(
        issuer.#key.publicIdentity().publicKey,
        data.identity.publicKey,
      )
    )
      throw new Error("Issuer key mismatch");
    for (const [id, state] of data.issued) {
      if (
        !/^[0-9a-f]{64}$/.test(id) ||
        typeof state.revoked !== "boolean" ||
        !(state.credentialRoot instanceof Uint8Array) ||
        state.credentialRoot.length !== 32
      )
        throw new Error("Invalid issuer registry state");
    }
    for (const [id, offer] of data.offers) {
      if (
        !/^[0-9a-f]{64}$/.test(id) ||
        (offer.level !== 1 && offer.level !== 2) ||
        !Number.isSafeInteger(offer.createdAt) ||
        !Number.isSafeInteger(offer.expiresAt) ||
        offer.createdAt < 0 ||
        offer.expiresAt !== offer.createdAt + 300
      )
        throw new Error("Invalid pending offer");
      if (offer.holder)
        core.assertValidVerificationMethodRef(offer.holder.method);
    }
    issuer.#registryId = Uint8Array.from(data.registryId);
    issuer.#active = data.active;
    issuer.#offers = new Map(data.offers);
    issuer.#issued = new Map(data.issued);
    if (data.completed) {
      if (!Array.isArray(data.completed) || data.completed.length > 128)
        throw new Error("Invalid issuance retry state");
      for (const [id, entry] of data.completed)
        if (
          !/^[0-9a-f]{64}$/.test(id) ||
          !(entry.root instanceof Uint8Array) ||
          entry.root.length !== 32 ||
          !Number.isSafeInteger(entry.until)
        )
          throw new Error("Invalid issuance retry entry");
      issuer.#completed = new Map(data.completed);
    }
    return issuer;
  }
  statusReader(): StatusReader {
    return {
      trust: this.publicTrust(),
      read: (id) => {
        const s = this.#issued.get(id);
        return s
          ? {
              active: this.#active,
              revoked: s.revoked,
              credentialRoot: Uint8Array.from(s.credentialRoot),
            }
          : undefined;
      },
    };
  }
}

/** Holder owns the key. Only public identity and signatures leave this object. */
export class Holder {
  #key: LocalSigningKey;
  #credentials = new Map<string, SignedQualification>();
  constructor(
    private clock: () => number = clockSeconds,
    key?: LocalSigningKey,
  ) {
    this.#key = key || new LocalSigningKey();
  }
  publicIdentity() {
    return this.#key.publicIdentity();
  }
  credentials() {
    return [...this.#credentials].map(([id, q]) => ({
      id,
      level: Number(q.claims.level),
      issuedAt: Number(q.credential.issuedAt),
      expiresAt: Number(q.credential.expiresAt),
    }));
  }
  request(offer: Offer): EnrollmentRequest {
    const now = checkedTime(this.clock);
    if (BigInt(now) >= offer.expiresAt)
      throw new Error("Issuance request expired");
    const identity = this.publicIdentity(),
      context: Enrollment = {
        tag: label("veilpass:enrollment:v1"),
        issuer: structuredClone(offer.issuer.method),
        holder: identity.method,
        holderPublicKey: identity.publicKey,
        challenge: Uint8Array.from(offer.challenge),
        expiresAt: offer.expiresAt,
      };
    return {
      context,
      proof: this.#key.sign(
        family.enrollmentRoot(context),
        "presentation",
        offer.challenge,
        now,
      ),
    };
  }
  accept(qualification: SignedQualification, trust: IssuerTrust) {
    validCredential(qualification, trust);
    const identity = this.publicIdentity();
    if (
      !samePoint(qualification.claims.holderPublicKey, identity.publicKey) ||
      !sameMethod(
        qualification.credential.holderBinding.holderVerificationMethodRef,
        identity.method,
      )
    )
      throw new Error("Credential belongs to another holder");
    if (
      this.#credentials.size >= 64 &&
      !this.#credentials.has(credentialId(qualification))
    )
      throw new Error("Holder credential limit reached");
    this.#credentials.set(
      credentialId(qualification),
      structuredClone(qualification),
    );
    return credentialId(qualification);
  }
  present(id: string, challenge: Challenge): PresentationWitness {
    const q = this.#credentials.get(id);
    if (!q) throw new Error("Unknown holder credential");
    const now = checkedTime(this.clock);
    if (BigInt(now) >= challenge.expiresAt)
      throw new Error("Presentation request expired");
    const presentation: Presentation = {
      version: 1n,
      schema: structuredClone(q.credential.schema),
      credentialClaimRoot: Uint8Array.from(q.credential.claimRoot),
      issuerVerificationMethodRef: structuredClone(
        q.credential.issuerVerificationMethodRef,
      ),
      holderBinding: structuredClone(q.credential.holderBinding),
      disclosed: {
        ...structuredClone(challenge),
        credentialRoot: family.credentialRoot(q.credential),
      },
    };
    return {
      qualification: structuredClone(q),
      presentation,
      proof: this.#key.sign(
        family.presentationRoot(presentation),
        "presentation",
        challenge.challenge,
        now,
      ),
    };
  }
  lock() {
    this.#key.lock();
    this.#credentials.clear();
  }
  async backup(passphrase: string) {
    return encryptBackup(
      encodeWire({
        version: 1,
        seed: this.#key.backupSeed(),
        method: this.publicIdentity().method,
        credentials: [...this.#credentials.values()],
      }),
      passphrase,
    );
  }
  static async restore(
    backup: string,
    passphrase: string,
    clock: () => number = clockSeconds,
  ) {
    try {
      const data = decodeWire(await decryptBackup(backup, passphrase)) as {
        version: number;
        seed: string;
        method: VerificationMethodRef;
        credentials: SignedQualification[];
      };
      if (
        data.version !== 1 ||
        typeof data.seed !== "string" ||
        !/^[0-9a-f]{64}$/.test(data.seed) ||
        !Array.isArray(data.credentials) ||
        data.credentials.length > 64
      )
        throw new Error();
      const seed = Uint8Array.from(data.seed.match(/../g) || [], (n) =>
        parseInt(n, 16),
      );
      let key: LocalSigningKey;
      try {
        key = new LocalSigningKey(seed, data.method);
      } finally {
        seed.fill(0);
      }
      const holder = new Holder(clock, key);
      core.assertValidVerificationMethodRef(holder.publicIdentity().method);
      for (const q of data.credentials) {
        // This checks backup integrity and ownership, not external issuer trust.
        // A verifier still requires its own pinned issuer and status reader.
        holder.accept(q, {
          method: q.credential.issuerVerificationMethodRef,
          publicKey: q.proof.publicKey,
          registryId: q.credential.statusBinding.registryRef.registryId,
        });
      }
      return holder;
    } catch {
      throw new Error("Could not unlock holder backup");
    }
  }
}

/** Generated signature/constraint execution, NOT a ZK transaction verifier. */
export class LocalVerifier {
  #reader: StatusReader;
  #requests = new Map<
    string,
    { request: Challenge; createdAt: number; used: boolean }
  >();
  #domain: Uint8Array;
  #audience: Uint8Array;
  constructor(
    reader: StatusReader,
    domain: string,
    audience: string,
    private policy: 1 | 2,
    private clock: () => number = clockSeconds,
  ) {
    if (policy !== 1 && policy !== 2) throw new Error("Unsupported policy");
    this.#reader = { trust: structuredClone(reader.trust), read: reader.read };
    this.#domain = label(domain);
    this.#audience = label(audience);
  }
  challenge(lifetime = 120): Challenge {
    assertSeconds(lifetime, 300);
    const now = checkedTime(this.clock);
    for (const [id, r] of this.#requests)
      if (r.request.expiresAt <= BigInt(now)) this.#requests.delete(id);
    if (this.#requests.size >= 128)
      throw new Error("Pending request limit reached");
    const request: Challenge = {
      domain: Uint8Array.from(this.#domain),
      audience: Uint8Array.from(this.#audience),
      policy: BigInt(this.policy),
      challenge: random32(),
      expiresAt: BigInt(now + lifetime),
    };
    this.#requests.set(hex(request.challenge), {
      request: structuredClone(request),
      createdAt: now,
      used: false,
    });
    return request;
  }
  verify(witness: PresentationWitness) {
    const context = witness.presentation.disclosed,
      id = hex(context.challenge),
      pending = this.#requests.get(id),
      now = checkedTime(this.clock);
    if (!pending) throw new Error("Unknown verification request");
    if (pending.used) throw new Error("Verification request already consumed");
    const expected = pending.request;
    if (
      !sameBytes(context.domain, expected.domain) ||
      !sameBytes(context.audience, expected.audience) ||
      context.policy !== expected.policy ||
      context.expiresAt !== expected.expiresAt
    )
      throw new Error("Verification context mismatch");
    const q = witness.qualification,
      trust = this.#reader.trust;
    if (BigInt(now) >= context.expiresAt)
      throw new Error("Verification request expired");
    if (
      q.credential.issuedAt > BigInt(now) ||
      q.credential.expiresAt <= BigInt(now)
    )
      throw new Error("Credential outside validity");
    if (
      witness.proof.createdAt < BigInt(pending.createdAt) ||
      witness.proof.createdAt > BigInt(now)
    )
      throw new Error("Presentation time invalid");
    validCredential(q, trust);
    assertCanonicalProof(witness.proof);
    family.verifyHolder(
      q.credential,
      q.claims,
      q.proof,
      trust.method,
      trust.publicKey,
      witness.presentation,
      witness.proof,
    );
    const after = checkedTime(this.clock);
    if (
      BigInt(after) >= expected.expiresAt ||
      q.credential.expiresAt <= BigInt(after)
    )
      throw new Error("Verification expired during validation");
    const status = this.#reader.read(credentialId(q));
    if (!status) throw new Error("Unknown credential status");
    if (!status.active) throw new Error("Issuer inactive");
    if (status.revoked) throw new Error("Credential revoked");
    if (!sameBytes(status.credentialRoot, family.credentialRoot(q.credential)))
      throw new Error("Status credential mismatch");
    pending.used = true;
    return {
      valid: true,
      eligible: true,
      policyId: this.policy === 1 ? "approved-training" : "professional-level",
      verificationReference: id,
      mode: "local-signed-credential" as const,
    };
  }
}
