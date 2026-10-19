// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const directory = path.dirname(fileURLToPath(import.meta.url));
const run = (args) =>
  execFileSync(process.execPath, args, { cwd: directory, encoding: "utf8" });
run(["compile.mjs"]);
run(["node_modules/typescript/bin/tsc", "--noEmit", "-p", "tsconfig.json"]);
const tap = run([
  "--import",
  "tsx",
  "--test",
  "--test-reporter=tap",
  "tests/issuance.test.ts",
]);
const tests = Number(tap.match(/^# tests (\d+)$/m)?.[1]),
  passed = Number(tap.match(/^# pass (\d+)$/m)?.[1]);
assert(tests > 0 && tests === passed && /^# fail 0$/m.test(tap));
const demo = JSON.parse(run(["--import", "tsx", "demo.ts"]));
const pkg = JSON.parse(
  readFileSync(path.join(directory, "package.json"), "utf8"),
);
const evidence = {
  checkedAt: new Date().toISOString(),
  scope:
    "Isolated local signed-issuance foundation; not integrated with V2 proof flow or hosted app",
  node: process.version,
  compact: "0.31.1",
  dependencies: pkg.dependencies,
  qualificationSourceSha256: createHash("sha256")
    .update(readFileSync(path.join(directory, "qualification.compact")))
    .digest("hex"),
  tests: { total: tests, passed, failed: 0 },
  ...demo,
};
const destination = path.resolve(
  directory,
  "../../docs/evidence/signed-issuance-local.json",
);
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(evidence, null, 2) + "\n");
console.log(
  `Validated ${passed} tests, type checking and the signed issuance/recovery/revocation demo. Evidence: ${destination}`,
);
