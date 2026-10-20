import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createSignedVerifier,
  requestKeyV3,
  type SnapshotV3,
  type AuthorizationV3,
  type ChallengeV3,
  type ChainV3,
} from "../src/verifier.js";
import { SqliteChallengeStore } from "../src/challenge-store.js";
test("V3 durable verifier binds confirmed authorization, refuses replay after restart and fails closed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "veilpass-v3-verifier-"));
  let store = new SqliteChallengeStore(dir),
    now = 1800000000;
  const domain = "ab".repeat(32),
    address = "cd".repeat(32),
    audience = "ef".repeat(32),
    reference = "00" + "12".repeat(32);
  let current: SnapshotV3 = {
    root: "34".repeat(32),
    domain,
    active: true,
    statusVersion: "0",
    observedAt: now,
  };
  let auth: AuthorizationV3 | null = null;
  const chain: ChainV3 = {
    currentState: async () => ({ ...current }),
    authorization: async () => auth,
  };
  const make = () =>
    createSignedVerifier({
      domain,
      audience,
      contractAddress: address,
      policy: 1,
      chain,
      store,
      now: () => now,
    });
  const presentation = (c: ChallengeV3) => ({
    version: 3,
    challengeId: c.id,
    transactionReference: reference,
  });
  try {
    const verifier = make(),
      c = await verifier.createChallenge();
    await assert.rejects(verifier.verify(presentation(c)), /confirmed/);
    auth = {
      requestKey: requestKeyV3(c),
      contractAddress: address,
      mode: "confirmed-midnight-v3",
      snapshot: { ...current },
    };
    assert.equal((await verifier.verify(presentation(c))).eligible, true);
    store.close();
    store = new SqliteChallengeStore(dir);
    await assert.rejects(make().verify(presentation(c)), /consumed/);
    const next = await make().createChallenge();
    auth = {
      ...auth,
      requestKey: requestKeyV3(next),
      snapshot: { ...current },
    };
    current.statusVersion = "1";
    await assert.rejects(make().verify(presentation(next)), /Status changed/);
    current.statusVersion = "0";
    current.observedAt -= 90;
    await assert.rejects(make().verify(presentation(next)), /Stale/);
    current.observedAt = now;
    current.active = false;
    await assert.rejects(make().verify(presentation(next)), /inactive/);
    current.active = true;
    now += 121;
    await assert.rejects(make().verify(presentation(next)), /expired/);
    await assert.rejects(
      make().verify({ ...presentation(next), version: 2 }),
      /Malformed/,
    );
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("SQLite challenge consumption is atomic across independent store instances", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "veilpass-v3-concurrent-"));
  const a = new SqliteChallengeStore(dir),
    b = new SqliteChallengeStore(dir);
  try {
    const id = "11".repeat(32);
    await a.put({
      version: 3,
      id,
      nonce: "22".repeat(32),
      audience: "33".repeat(32),
      domain: "44".repeat(32),
      contractAddress: "55".repeat(32),
      policy: 1,
      issuedAt: 1,
      expiresAt: 121,
    });
    assert.deepEqual(
      (await Promise.all([a.consume(id), b.consume(id)])).sort(),
      [false, true],
    );
  } finally {
    a.close();
    b.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("challenge freshness uses the time after the indexer response, not before the request", async () => {
  let time = 1800000000;
  const domain = "ab".repeat(32),
    audience = "cd".repeat(32),
    contractAddress = "ef".repeat(32);
  const verifier = createSignedVerifier({
    domain,
    audience,
    contractAddress,
    policy: 1,
    now: () => time,
    chain: {
      currentState: async () => {
        time += 2;
        return {
          domain,
          active: true,
          root: "12".repeat(32),
          statusVersion: "0",
          observedAt: time,
        };
      },
      authorization: async () => null,
    },
    store: {
      put: async () => {},
      get: async () => null,
      consume: async () => false,
    },
  });
  assert.equal((await verifier.createChallenge()).issuedAt, 1800000002);
});
