// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, stat, symlink, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  IssuerAuthority,
  Holder,
  LocalVerifier,
  credentialId,
  encodeWire,
  decodeWire,
  qualificationFamily,
  type EnrollmentRequest,
  type SignedQualification,
} from "../src/index.js";
import { LocalSigningKey, label, samePoint } from "../src/crypto.js";
import { pureCircuits as family } from "../managed/contract/index.js";
import { saveHolderBackup, loadHolderBackup } from "../src/storage.js";
import { JUBJUB_ORDER } from "@midnight-ntwrk/midnight-did-jubjub-schnorr";
const PASSWORD = "test-only recovery passphrase 2026";
function setup(level: 1 | 2 = 2, lifetime = 86400) {
  let time = 1800000000;
  const clock = () => time,
    issuer = new IssuerAuthority(clock, lifetime),
    holder = new Holder(clock);
  const offer = issuer.approve(level),
    request = holder.request(offer),
    q = issuer.issue(decodeWire(encodeWire(request)) as EnrollmentRequest),
    id = holder.accept(q, issuer.publicTrust());
  const a = new LocalVerifier(
      issuer.statusReader(),
      "veilpass:local:signed",
      "hackathon.example",
      1,
      clock,
    ),
    b = new LocalVerifier(
      issuer.statusReader(),
      "veilpass:local:signed",
      "community.example",
      2,
      clock,
    );
  return {
    clock,
    issuer,
    holder,
    offer,
    request,
    q,
    id,
    a,
    b,
    advance: (seconds: number) => {
      time += seconds;
    },
  };
}

test("official family metadata and exact compiled issuer/holder signature checks", () => {
  const s = setup();
  assert.equal(qualificationFamily.schema.claims.length, 4);
  const a = s.a.verify(s.holder.present(s.id, s.a.challenge())),
    b = s.b.verify(s.holder.present(s.id, s.b.challenge()));
  assert.equal(a.mode, "local-signed-credential");
  assert.equal(a.eligible, true);
  assert.equal(b.policyId, "professional-level");
  assert.deepEqual(Object.keys(a).sort(), [
    "eligible",
    "mode",
    "policyId",
    "valid",
    "verificationReference",
  ]);
});
test("only public enrollment context and signatures cross the issuer boundary", () => {
  const s = setup();
  assert.deepEqual(Object.keys(s.request).sort(), ["context", "proof"]);
  const request = encodeWire(s.request),
    witness = encodeWire(s.holder.present(s.id, s.a.challenge()));
  for (const value of [request, witness, JSON.stringify(s.issuer)]) {
    assert(!/holderSecret|seed|privateKey|secretScalar/.test(value));
  }
  assert.equal(
    samePoint(s.request.context.holderPublicKey, s.q.claims.holderPublicKey),
    true,
  );
});
test("issuer approval determines the level, not applicant-provided properties", () => {
  let time = 1800000000;
  const issuer = new IssuerAuthority(() => time),
    holder = new Holder(() => time);
  const request = holder.request(issuer.approve(1));
  (request.context as unknown as Record<string, unknown>).level = 2n;
  const q = issuer.issue(request);
  assert.equal(q.claims.level, 1n);
});
test("request is consumed once and cannot issue a duplicate credential", () => {
  const s = setup();
  assert.throws(() => s.issuer.issue(s.request), /not pending/);
});
test("expired enrollment and enrollment for a different issuer fail", () => {
  const s = setup();
  const expired = s.holder.request(s.issuer.approve(2));
  s.advance(300);
  assert.throws(() => s.issuer.issue(expired), /expired/);
  const offer = s.issuer.approve(2),
    request = s.holder.request(offer);
  request.context.issuer.methodId[0] ^= 1;
  assert.throws(() => s.issuer.issue(request), /context/);
});
test("enrollment key substitution and forged holder signature fail", () => {
  const s = setup();
  const request = s.holder.request(s.issuer.approve(2));
  request.context.holderPublicKey =
    new LocalSigningKey().publicIdentity().publicKey;
  assert.throws(() => s.issuer.issue(request), /holder mismatch/);
  const forged = s.holder.request(s.issuer.approve(2));
  forged.proof.signature.s = (forged.proof.signature.s + 1n) % JUBJUB_ORDER;
  assert.throws(() => s.issuer.issue(forged));
});
test("enrollment signature cannot be repurposed as a credential signature", () => {
  const s = setup();
  const changed = structuredClone(s.q);
  changed.proof = s.request.proof;
  assert.throws(() => s.holder.accept(changed, s.issuer.publicTrust()));
});
test("issuer-signed credential rejects tampered claims, key, expiry, schema and status handle", () => {
  const s = setup();
  const mutations: Array<(q: SignedQualification) => void> = [
    (q) => {
      q.claims.level = 1n;
    },
    (q) => {
      q.claims.holderPublicKey =
        new LocalSigningKey().publicIdentity().publicKey;
    },
    (q) => {
      q.credential.expiresAt += 1n;
    },
    (q) => {
      q.credential.schema.minorVersion = 1n;
    },
    (q) => {
      q.credential.statusBinding.statusHandleCommitment[0] ^= 1;
    },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(s.q);
    mutate(changed);
    assert.throws(() => s.holder.accept(changed, s.issuer.publicTrust()));
  }
});
test("self-signed or untrusted issuer and status registry are rejected", () => {
  const s = setup(),
    other = new IssuerAuthority(s.clock);
  assert.throws(
    () => s.holder.accept(s.q, other.publicTrust()),
    /Untrusted issuer/,
  );
  const trust = s.issuer.publicTrust();
  trust.registryId[0] ^= 1;
  assert.throws(() => s.holder.accept(s.q, trust), /registry/);
});
test("copied credential cannot be imported by a different holder", () => {
  const s = setup(),
    thief = new Holder(s.clock);
  assert.throws(
    () => thief.accept(s.q, s.issuer.publicTrust()),
    /another holder/,
  );
});
test("copied method reference does not authorize an attacker public key", () => {
  const s = setup();
  const challenge = s.a.challenge(),
    w = s.holder.present(s.id, challenge);
  const attacker = new LocalSigningKey(
    undefined,
    w.proof.signerVerificationMethodRef,
  );
  w.proof = attacker.sign(
    family.presentationRoot(w.presentation),
    "presentation",
    challenge.challenge,
    s.clock(),
  );
  assert.throws(() => s.a.verify(w), /Jubjub points do not match/);
});
test("identity-point and noncanonical scalar signatures are rejected", () => {
  const s = setup();
  for (const change of [
    (w: ReturnType<Holder["present"]>) => {
      w.proof.publicKey = { x: 0n, y: 1n };
    },
    (w: ReturnType<Holder["present"]>) => {
      w.proof.signature.s += JUBJUB_ORDER;
    },
  ]) {
    const w = s.holder.present(s.id, s.a.challenge());
    change(w);
    assert.throws(() => s.a.verify(w));
  }
});
test("wrong policy, audience, domain, challenge and deadline fail", () => {
  const s = setup();
  const mutations: Array<(w: ReturnType<Holder["present"]>) => void> = [
    (w) => {
      w.presentation.disclosed.policy = 2n;
    },
    (w) => {
      w.presentation.disclosed.audience = label("other.example");
    },
    (w) => {
      w.presentation.disclosed.domain = label("other-network");
    },
    (w) => {
      w.presentation.disclosed.challenge[0] ^= 1;
    },
    (w) => {
      w.presentation.disclosed.expiresAt += 1n;
    },
  ];
  for (const mutate of mutations) {
    const w = s.holder.present(s.id, s.a.challenge());
    mutate(w);
    assert.throws(() => s.a.verify(w));
  }
});
test("cross-verifier substitution and presentation replay fail", () => {
  const s = setup();
  const w = s.holder.present(s.id, s.a.challenge());
  assert.throws(() => s.b.verify(w), /Unknown/);
  s.a.verify(w);
  assert.throws(() => s.a.verify(w), /consumed/);
});
test("failed signature does not consume a valid request; retry succeeds", () => {
  const s = setup(),
    good = s.holder.present(s.id, s.a.challenge()),
    bad = structuredClone(good);
  bad.proof.signature.s = (bad.proof.signature.s + 1n) % JUBJUB_ORDER;
  assert.throws(() => s.a.verify(bad));
  assert.equal(s.a.verify(good).valid, true);
});
test("level-one qualification cannot satisfy the professional policy", () => {
  const s = setup(1);
  assert.equal(s.a.verify(s.holder.present(s.id, s.a.challenge())).valid, true);
  assert.throws(
    () => s.b.verify(s.holder.present(s.id, s.b.challenge())),
    /level too low/,
  );
});
test("credential and request expiration and future-dated holder proofs fail", () => {
  const s = setup(2, 10);
  const w = s.holder.present(s.id, s.a.challenge());
  s.advance(10);
  assert.throws(() => s.a.verify(w), /validity/);
  const t = setup();
  const old = t.holder.present(t.id, t.a.challenge(1));
  t.advance(1);
  assert.throws(() => t.a.verify(old), /expired/);
  const future = t.holder.present(t.id, t.a.challenge());
  future.proof.createdAt += 1n;
  assert.throws(() => t.a.verify(future), /time invalid/);
});
test("revocation rejects old and fresh presentations and survives backup restoration", async () => {
  const s = setup();
  const backup = await s.holder.backup(PASSWORD),
    pending = s.holder.present(s.id, s.a.challenge());
  s.issuer.revoke(s.id);
  assert.throws(() => s.a.verify(pending), /revoked/);
  const restored = await Holder.restore(backup, PASSWORD, s.clock);
  assert.throws(
    () => s.b.verify(restored.present(s.id, s.b.challenge())),
    /revoked/,
  );
  s.issuer.revoke(s.id);
  assert.throws(
    () => s.a.verify(s.holder.present(s.id, s.a.challenge())),
    /revoked/,
  );
});
test("issuer deactivation rejects pending authorization and further issuance", () => {
  const s = setup();
  const pending = s.holder.present(s.id, s.a.challenge());
  s.issuer.deactivate();
  assert.throws(() => s.a.verify(pending), /inactive/);
  assert.throws(() => s.issuer.approve(2), /inactive/);
});
test("status snapshots and challenge copies cannot mutate authority state", () => {
  const s = setup();
  const reader = s.issuer.statusReader(),
    status = reader.read(s.id)!;
  status.revoked = true;
  status.credentialRoot.fill(0);
  assert.equal(s.a.verify(s.holder.present(s.id, s.a.challenge())).valid, true);
  const challenge = s.a.challenge(),
    w = s.holder.present(s.id, challenge);
  challenge.audience.fill(0);
  assert.equal(s.a.verify(w).valid, true);
});
test("encrypted backups are randomized, contain no plaintext credential, and restore ownership", async () => {
  const s = setup();
  const a = await s.holder.backup(PASSWORD),
    b = await s.holder.backup(PASSWORD);
  assert.notEqual(a, b);
  assert(!a.includes("holderPublicKey") && !a.includes("seed"));
  s.holder.lock();
  assert.throws(() => s.holder.request(s.issuer.approve(2)), /locked/);
  const restored = await Holder.restore(a, PASSWORD, s.clock);
  assert.equal(
    samePoint(restored.publicIdentity().publicKey, s.q.claims.holderPublicKey),
    true,
  );
  assert.equal(
    s.b.verify(restored.present(s.id, s.b.challenge())).eligible,
    true,
  );
});
test("wrong backup passwords, ciphertext tampering and modified KDF settings fail", async () => {
  const s = setup(),
    backup = await s.holder.backup(PASSWORD);
  await assert.rejects(
    () => Holder.restore(backup, "wrong password", s.clock),
    /unlock/,
  );
  const b = JSON.parse(backup);
  b.ciphertext = (b.ciphertext[0] === "A" ? "B" : "A") + b.ciphertext.slice(1);
  await assert.rejects(
    () => Holder.restore(JSON.stringify(b), PASSWORD, s.clock),
    /unlock/,
  );
  b.iterations = 1000000000;
  await assert.rejects(
    () => Holder.restore(JSON.stringify(b), PASSWORD, s.clock),
    /unlock/,
  );
  await assert.rejects(() => s.holder.backup("short"), /passphrase/);
});
test("owner-only files persist encrypted recovery and refuse overwrites, links and loose permissions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "veilpass-issuance-"));
  try {
    const s = setup(),
      file = path.join(directory, "holder.backup.json");
    await saveHolderBackup(file, s.holder, PASSWORD);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert(!(await readFile(file, "utf8")).includes("holderPublicKey"));
    const restored = await loadHolderBackup(file, PASSWORD, s.clock);
    assert.equal(
      s.a.verify(restored.present(s.id, s.a.challenge())).valid,
      true,
    );
    await assert.rejects(
      () => saveHolderBackup(file, s.holder, PASSWORD),
      /EEXIST/,
    );
    const link = path.join(directory, "link");
    await symlink(file, link);
    await assert.rejects(() => loadHolderBackup(link, PASSWORD));
    await chmod(file, 0o644);
    await assert.rejects(() => loadHolderBackup(file, PASSWORD), /owner-only/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("bounded wire encoding round-trips native Compact values and rejects ambiguous tags", () => {
  const s = setup(),
    copy = decodeWire(encodeWire(s.q)) as SignedQualification;
  assert.equal(credentialId(copy), s.id);
  assert.equal(s.holder.accept(copy, s.issuer.publicTrust()), s.id);
  assert.throws(
    () => decodeWire('{"$veilpass":"bigint","value":"01"}'),
    /Malformed/,
  );
  assert.throws(() => decodeWire("x".repeat(1024 * 1024 + 1)), /large/);
});

test("identity-point enrollment fails even when the claimed key and proof key agree", () => {
  const s = setup(),
    request = s.holder.request(s.issuer.approve(2));
  request.context.holderPublicKey = { x: 0n, y: 1n };
  request.proof.publicKey = { x: 0n, y: 1n };
  request.proof.signature = { r: { x: 0n, y: 1n }, s: 0n };
  assert.throws(() => s.issuer.issue(request), /identity point/);
});
test("expiration is checked again after expensive signature validation", () => {
  const s = setup();
  let reads = 0;
  const clock = () => s.clock() + (reads++ >= 2 ? 120 : 0);
  const verifier = new LocalVerifier(
    s.issuer.statusReader(),
    "veilpass:local:signed",
    "slow.example",
    1,
    clock,
  );
  const w = s.holder.present(s.id, verifier.challenge());
  assert.throws(() => verifier.verify(w), /during validation/);
});
test("unknown or mismatched current status cannot authorize a valid signed credential", () => {
  const s = setup(),
    reader = s.issuer.statusReader();
  for (const read of [
    () => undefined,
    (id: string) => {
      const status = reader.read(id)!;
      status.credentialRoot.fill(0);
      return status;
    },
  ]) {
    const verifier = new LocalVerifier(
      { trust: reader.trust, read },
      "veilpass:local:signed",
      "status.example",
      1,
      s.clock,
    );
    assert.throws(
      () => verifier.verify(s.holder.present(s.id, verifier.challenge())),
      /status|Status/,
    );
  }
});

test("holder-bound approvals reject an intercepted offer", () => {
  const issuer = new IssuerAuthority(),
    owner = new Holder(),
    attacker = new Holder();
  const offer = issuer.approve(2, owner.publicIdentity());
  assert.throws(() => issuer.issue(attacker.request(offer)), /not approved/);
  const signed = issuer.issue(owner.request(offer));
  assert.equal(owner.accept(signed, issuer.publicTrust()).length, 64);
});

test("issuer snapshots preserve key, pending offers, status and irreversible revocation", () => {
  const issuer = new IssuerAuthority(),
    holder = new Holder();
  const trust = issuer.publicTrust(),
    offer = issuer.approve(2, holder.publicIdentity());
  const restored = IssuerAuthority.fromState(issuer.exportState());
  assert.deepEqual(restored.publicTrust(), trust);
  const q = restored.issue(holder.request(offer)),
    id = holder.accept(q, trust);
  const again = IssuerAuthority.fromState(restored.exportState());
  assert.throws(() => again.issue(holder.request(offer)), /not pending/);
  again.revoke(id);
  const revoked = IssuerAuthority.fromState(again.exportState());
  assert.equal(revoked.statusReader().read(id)?.revoked, true);
  revoked.deactivate();
  assert.throws(
    () => IssuerAuthority.fromState(revoked.exportState()).approve(1),
    /inactive/,
  );
});

test("durable enrollment retries recover the same credential and reject key substitution or revoked retries", () => {
  const issuer = new IssuerAuthority(),
    holder = new Holder(),
    attacker = new Holder();
  const offer = issuer.approve(2, holder.publicIdentity()),
    request = holder.request(offer);
  const q = issuer.issueOrResume(request),
    restored = IssuerAuthority.fromState(issuer.exportState());
  assert.deepEqual(restored.issueOrResume(holder.request(offer)), q);
  assert.equal(restored.statusEntries().length, 1);
  assert.throws(() => restored.issueOrResume(attacker.request(offer)));
  restored.revoke(credentialId(q));
  assert.throws(() => restored.issueOrResume(request), /revoked/);
});

test("wire integers survive wallet SDK global BigInt JSON hooks", () => {
  const previous = Object.getOwnPropertyDescriptor(BigInt.prototype, "toJSON");
  try {
    Object.defineProperty(BigInt.prototype, "toJSON", {
      configurable: true,
      value: function (this: bigint) {
        return this.toString();
      },
    });
    const issuer = new IssuerAuthority(),
      holder = new Holder();
    const trust = decodeWire(encodeWire(issuer.publicTrust())) as ReturnType<
      IssuerAuthority["publicTrust"]
    >;
    assert.deepEqual(decodeWire(encodeWire(Buffer.from([1, 2, 3]))), new Uint8Array([1, 2, 3]));
    assert.equal(typeof trust.publicKey.x, "bigint");
    assert.deepEqual(trust, issuer.publicTrust());
    const restored = IssuerAuthority.fromState(issuer.exportState());
    assert.deepEqual(restored.publicTrust(), trust);
    const offer = restored.approve(2, holder.publicIdentity());
    const q = restored.issue(
      decodeWire(encodeWire(holder.request(offer))) as EnrollmentRequest,
    );
    holder.accept(q, trust);
  } finally {
    if (previous) Object.defineProperty(BigInt.prototype, "toJSON", previous);
    else Reflect.deleteProperty(BigInt.prototype, "toJSON");
  }
});
