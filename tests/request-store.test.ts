import { mkdtempSync, rmSync, chmodSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { RequestStore } from "../integrations/issuance/src/request-store";
const directories: string[] = [];
const stores: RequestStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function directory() { const d = mkdtempSync(path.join(tmpdir(), "veilpass-limits-")); directories.push(d); return d; }
function store(d: string) { const s = new RequestStore(d); stores.push(s); return s; }
it("shares admission across connections and preserves limits after restart", () => {
  const d = directory(), a = store(d), b = store(d);
  expect(a.take("issuer", 2, 60000, 1000)).toBe(true);
  expect(b.take("issuer", 2, 60000, 1001)).toBe(true);
  expect(a.take("issuer", 2, 60000, 1002)).toBe(false);
  a.close(); stores.splice(stores.indexOf(a), 1);
  const restarted = store(d);
  expect(restarted.take("issuer", 2, 60000, 1003)).toBe(false);
  expect(restarted.take("issuer", 2, 60000, 61000)).toBe(true);
});
it("keeps separate budgets and rejects unsafe state paths", () => {
  const d = directory(), s = store(d);
  expect(s.take("issuer", 1, 1000, 0)).toBe(true);
  expect(s.take("verifier", 1, 1000, 0)).toBe(true);
  expect(() => s.take("unbounded/user/key", 1, 1000)).toThrow();
  const unsafe = directory(); chmodSync(unsafe, 0o755);
  expect(() => new RequestStore(unsafe)).toThrow("owner-only");
  const linked = path.join(directory(), "link"); symlinkSync(d, linked);
  expect(() => new RequestStore(linked)).toThrow("owner-only");
});
