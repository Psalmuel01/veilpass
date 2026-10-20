import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { bootstrapIssuer } from "../integrations/issuance/src/bootstrap";

it("requires explicit creation, pins identity, and refuses replacement after database loss", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "veilpass-bootstrap-"));
  const key = "test-only-storage-password-".repeat(3);
  try {
    await expect(bootstrapIssuer(dir, key)).rejects.toThrow("explicit");
    const fingerprint = await bootstrapIssuer(dir, key, true);
    expect(await bootstrapIssuer(dir, key)).toBe(fingerprint);
    await expect(bootstrapIssuer(dir, "different-password-".repeat(3))).rejects.toThrow();
    expect((await readFile(path.join(dir, "identity.sha256"), "utf8")).trim()).toBe(fingerprint);
    await rm(path.join(dir, "issuer.sqlite"));
    await expect(bootstrapIssuer(dir, key, true)).rejects.toThrow("database missing");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("rejects a database whose issuer differs from the pinned identity", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "veilpass-bootstrap-"));
  const key = "test-only-storage-password-".repeat(3);
  try {
    await bootstrapIssuer(dir, key, true);
    await writeFile(path.join(dir, "identity.sha256"), "0".repeat(64) + "\n", { mode: 0o600 });
    await expect(bootstrapIssuer(dir, key)).rejects.toThrow("identity changed");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
