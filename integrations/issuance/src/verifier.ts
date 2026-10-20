// SPDX-License-Identifier: Apache-2.0
// Independent V3 verifier: never accepts credentials or private witnesses.
import { random32, hex } from "./crypto.js";
import { pureCircuits } from "../managed-authorization/contract/index.js";
export type ChallengeV3 = {
  version: 3;
  id: string;
  nonce: string;
  audience: string;
  domain: string;
  contractAddress: string;
  policy: 1 | 2;
  issuedAt: number;
  expiresAt: number;
};
export type SnapshotV3 = {
  domain: string;
  active: boolean;
  root: string;
  statusVersion: string;
  observedAt: number;
};
export type AuthorizationV3 = {
  requestKey: string;
  contractAddress: string;
  snapshot: SnapshotV3;
  mode: "confirmed-midnight-v3";
};
export type ChainV3 = {
  currentState(): Promise<SnapshotV3>;
  authorization(reference: string): Promise<AuthorizationV3 | null>;
};
export type ChallengeStoreV3 = {
  put(c: ChallengeV3): Promise<void>;
  get(id: string): Promise<ChallengeV3 | null>;
  consume(id: string): Promise<boolean>;
};
export function fromHex(s: string) {
  if (typeof s !== "string" || !/^[0-9a-f]{64}$/.test(s))
    throw new Error("Invalid 32-byte identifier");
  return Uint8Array.from(s.match(/../g)!, (n) => parseInt(n, 16));
}
export const requestKeyV3 = (c: ChallengeV3) =>
  hex(
    pureCircuits.authorizationKey(
      fromHex(c.domain),
      fromHex(c.audience),
      BigInt(c.policy),
      fromHex(c.nonce),
      BigInt(c.expiresAt),
    ),
  );
export function createSignedVerifier(options: {
  audience: string;
  domain: string;
  contractAddress: string;
  policy: 1 | 2;
  chain: ChainV3;
  store: ChallengeStoreV3;
  now?: () => number;
  maxStateAge?: number;
}) {
  const o = options,
    now = o.now || (() => Math.floor(Date.now() / 1000)),
    maxAge = o.maxStateAge ?? 30;
  [o.audience, o.domain, o.contractAddress].forEach(fromHex);
  if (
    ![1, 2].includes(o.policy) ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < 0 ||
    maxAge > 60
  )
    throw new Error("Invalid verifier configuration");
  function fresh(s: SnapshotV3, t: number) {
    if (
      !s ||
      s.domain !== o.domain ||
      typeof s.active !== "boolean" ||
      !/^(0|[1-9][0-9]*)$/.test(s.statusVersion)
    )
      throw new Error("Invalid canonical state");
    fromHex(s.root);
    if (
      !Number.isSafeInteger(s.observedAt) ||
      s.observedAt > t ||
      t - s.observedAt > maxAge
    )
      throw new Error("Stale canonical state");
    if (!s.active) throw new Error("Issuer inactive");
  }
  return {
    async createChallenge(ttl = 120): Promise<ChallengeV3> {
      if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 300)
        throw new Error("Invalid challenge lifetime");
      const current = await o.chain.currentState();
      const t = now();
      fresh(current, t);
      const c: ChallengeV3 = {
        version: 3,
        id: hex(random32()),
        nonce: hex(random32()),
        audience: o.audience,
        domain: o.domain,
        contractAddress: o.contractAddress,
        policy: o.policy,
        issuedAt: t,
        expiresAt: t + ttl,
      };
      await o.store.put(c);
      return c;
    },
    async verify(value: unknown) {
      if (!value || typeof value !== "object")
        throw new Error("Malformed V3 presentation");
      const p = value as {
        version: number;
        challengeId: string;
        transactionReference: string;
      };
      if (
        p.version !== 3 ||
        !/^[0-9a-f]{64}$/.test(p.challengeId) ||
        !/^00[0-9a-f]{64}$/.test(p.transactionReference)
      )
        throw new Error("Malformed V3 presentation");
      const c = await o.store.get(p.challengeId);
      if (
        !c ||
        c.version !== 3 ||
        c.policy !== o.policy ||
        c.domain !== o.domain ||
        c.audience !== o.audience ||
        c.contractAddress !== o.contractAddress
      )
        throw new Error("Wrong verifier challenge context");
      fromHex(c.nonce);
      const t = now();
      if (
        !Number.isSafeInteger(c.issuedAt) ||
        !Number.isSafeInteger(c.expiresAt) ||
        c.expiresAt - c.issuedAt < 1 ||
        c.expiresAt - c.issuedAt > 300 ||
        t < c.issuedAt ||
        t >= c.expiresAt
      )
        throw new Error("Challenge expired or invalid");
      const auth = await o.chain.authorization(p.transactionReference);
      if (
        !auth ||
        auth.mode !== "confirmed-midnight-v3" ||
        auth.contractAddress !== o.contractAddress ||
        auth.requestKey !== requestKeyV3(c)
      )
        throw new Error("No matching confirmed V3 authorization");
      const current = await o.chain.currentState(),
        after = now();
      fresh(current, after);
      if (after >= c.expiresAt)
        throw new Error("Challenge expired during verification");
      if (
        current.root !== auth.snapshot.root ||
        current.statusVersion !== auth.snapshot.statusVersion ||
        current.domain !== auth.snapshot.domain ||
        !auth.snapshot.active
      )
        throw new Error("Status changed; create a fresh authorization");
      if (!(await o.store.consume(c.id)))
        throw new Error("Challenge already consumed");
      return {
        valid: true,
        eligible: true,
        policyId: c.policy === 1 ? "approved-training" : "professional-level",
        verificationReference: p.transactionReference,
        mode: "confirmed-midnight-v3" as const,
      };
    },
  };
}
