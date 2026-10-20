// Real Postgres acceptance against an explicitly disposable loopback database.
// Never point this script at Neon or any application database.
import assert from "node:assert/strict";
import { PostgresStorage } from "../integrations/issuance/src/postgres.js";
import { operatorToken } from "../integrations/issuance/src/operators.js";
import { Holder } from "../integrations/issuance/src/index.js";
import type { ChallengeV3 } from "../integrations/issuance/src/verifier.js";

const url = process.env.VEILPASS_TEST_DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1" || new URL(url).pathname !== "/veilpass")
  throw new Error("Use the explicitly disposable loopback test database");
const password = "disposable-test-storage-password-".repeat(2);
const first = new PostgresStorage(url, true), second = new PostgresStorage(url, true);
try {
  await first.initialize();
  await assert.rejects(first.bootstrap(password), /explicit bootstrap/);
  const fingerprint = await first.bootstrap(password, true);
  assert.equal(await second.bootstrap(password), fingerprint);
  const originalToken = operatorToken(), replacementToken = operatorToken();
  await first.provisionOperator("pilot-issuer", "issuer", originalToken, Date.now() + 3600000);
  assert.deepEqual(await second.authenticateOperator(originalToken), { id: "pilot-issuer", role: "issuer" });
  assert.equal(await second.authenticateOperator("invalid"), null);
  await assert.rejects(second.provisionOperator("pilot-issuer", "administrator", replacementToken, Date.now() + 3600000));
  await second.provisionOperator("pilot-issuer", "revoker", replacementToken, Date.now() + 3600000, true);
  assert.equal(await first.authenticateOperator(originalToken), null);
  assert.deepEqual(await first.authenticateOperator(replacementToken), { id: "pilot-issuer", role: "revoker" });
  await first.disableOperator("pilot-issuer");
  assert.equal(await second.authenticateOperator(replacementToken), null);
  await first.provisionOperator("expired-issuer", "issuer", operatorToken(), Date.now() + 3600000);
  await first.pool.query("UPDATE veilpass_operators SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id='expired-issuer'");
  assert.equal((await first.operators()).length, 2);
  const holder = new Holder();
  const trust = await first.withIssuer(password, (issuer) => issuer.publicTrust());
  const offers = await Promise.all([1, 2].map((level) =>
    second.withIssuer(password, (issuer) => issuer.approve(level as 1 | 2, holder.publicIdentity()))));
  const q = await first.withIssuer(password, (issuer) => issuer.issue(holder.request(offers[0])));
  const id = holder.accept(q, trust);
  await assert.rejects(second.withIssuer(password, (issuer) => { issuer.revoke(id); throw Error("abort"); }), /abort/);
  assert.equal((await first.withIssuer(password, (issuer) => issuer.statusReader().read(id)))?.revoked, false);
  await second.withIssuer(password, (issuer) => issuer.revoke(id), { actor: "pilot-revoker", action: "revoke" });
  assert.equal((await first.pool.query("SELECT count(*)::int AS n FROM veilpass_audit WHERE actor='pilot-revoker' AND action='revoke' AND authority_version IS NOT NULL")).rows[0].n, 1);
  assert.equal((await first.withIssuer(password, (issuer) => issuer.statusReader().read(id)))?.revoked, true);
  await first.withIssuer(password, (issuer) => issuer.issue(holder.request(offers[1])));
  await assert.rejects(second.bootstrap("incorrect-storage-password-".repeat(2)));
  const { rows } = await first.pool.query("SELECT encrypted FROM veilpass_authority");
  assert.equal(rows[0].encrypted.includes('"seed"'), false);
  const ns = "a".repeat(64) + ":1", now = Math.floor(Date.now() / 1000);
  const challenge: ChallengeV3 = {
    version: 3, id: "b".repeat(64), nonce: "c".repeat(64), audience: "d".repeat(64),
    domain: "e".repeat(64), contractAddress: "a".repeat(64), policy: 1,
    issuedAt: now, expiresAt: now + 120,
  };
  const a = first.challengeStore(ns), b = second.challengeStore(ns);
  await a.put(challenge);
  assert.deepEqual(await b.get(challenge.id), challenge);
  assert.equal(await second.challengeStore("a".repeat(64) + ":2").get(challenge.id), null);
  const consumed = await Promise.all([a.consume(challenge.id), b.consume(challenge.id)]);
  assert.equal(consumed.filter(Boolean).length, 1);
  assert.equal(await first.challengeStore(ns).consume(challenge.id), false);
  const expired = { ...challenge, id: "f".repeat(64), expiresAt: now - 1 };
  await a.put(expired);
  assert.equal(await b.consume(expired.id), false);
  const budgets = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    (i % 2 ? first : second).take("test-budget", 3, 60)));
  assert.equal(budgets.filter(Boolean).length, 3);
  const snapshot = await first.encryptedSnapshot(password);
  await assert.rejects(first.restoreSnapshot(snapshot, password), /already contains/);
  await assert.rejects(first.restoreSnapshot({ ...snapshot, fingerprint: "0".repeat(64) }, password), /identity mismatch/);
  const replacementKey = "replacement-test-storage-key-".repeat(2);
  await first.rotateStorageKey(password, replacementKey);
  await assert.rejects(second.bootstrap(password));
  assert.equal(await second.bootstrap(replacementKey), fingerprint);
  await first.rotateStorageKey(replacementKey, password);
  // Explicitly disposable loopback database only: exercise empty-target restoration.
  await first.pool.query("DELETE FROM veilpass_authority");
  await first.restoreSnapshot(snapshot, password);
  assert.equal(await second.bootstrap(password), fingerprint);
  assert.equal((await second.withIssuer(password, issuer => issuer.statusReader().read(id)))?.revoked, true);
  await second.close();
  const restarted = new PostgresStorage(url, true);
  try {
    assert.equal(await restarted.bootstrap(password), fingerprint);
    assert.equal(await restarted.challengeStore(ns).consume(challenge.id), false);
    assert.equal(await restarted.take("test-budget", 3, 60), false);
  } finally { await restarted.close(); }
  holder.lock();
  console.log("Postgres acceptance passed: operator roles, hashed credentials, rotation, disablement, atomic audit, encrypted issuance, concurrent updates, rollback, revocation, restart, namespace isolation, replay, expiry and durable limits.");
} finally { await first.close(); await second.close().catch(() => {}); }
