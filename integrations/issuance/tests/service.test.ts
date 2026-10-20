import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withIssuer } from "../src/service.js";
import { Holder } from "../src/index.js";
const password = "test storage encryption key with enough entropy length";
test("encrypted SQLite authority survives restarts, concurrent updates and failed operations", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "veilpass-service-"));
  try {
    const holder = new Holder();
    const trust = await withIssuer(directory, password, (i) => i.publicTrust());
    const offers = await Promise.all(
      [1, 2].map((level) =>
        withIssuer(directory, password, (i) =>
          i.approve(level as 1 | 2, holder.publicIdentity()),
        ),
      ),
    );
    const q = await withIssuer(directory, password, (i) =>
      i.issue(holder.request(offers[0])),
    );
    const id = holder.accept(q, trust);
    await assert.rejects(
      withIssuer(directory, password, (i) => {
        i.revoke(id);
        throw Error("abort");
      }),
      /abort/,
    );
    assert.equal(
      (await withIssuer(directory, password, (i) => i.statusReader().read(id)))
        ?.revoked,
      false,
    );
    await withIssuer(directory, password, (i) => i.revoke(id));
    assert.equal(
      (await withIssuer(directory, password, (i) => i.statusReader().read(id)))
        ?.revoked,
      true,
    );
    await withIssuer(directory, password, (i) =>
      i.issue(holder.request(offers[1])),
    );
    await assert.rejects(
      withIssuer(directory, "wrong storage key long enough for test", (i) =>
        i.publicTrust(),
      ),
    );
    const bytes = await readFile(path.join(directory, "issuer.sqlite"));
    assert.equal(
      bytes.includes(Buffer.from("veilpass:issuer-state:v1")),
      false,
    );
    assert.equal(bytes.includes(Buffer.from('"seed"')), false);
    await chmod(directory, 0o755);
    await assert.rejects(
      withIssuer(directory, password, (i) => i.publicTrust()),
      /owner-only/,
    );
  } finally {
    await chmod(directory, 0o700);
    await rm(directory, { recursive: true, force: true });
  }
});
