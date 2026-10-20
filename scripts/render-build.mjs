import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import "./check-node.mjs";
const run = (...args) => execFileSync(process.execPath, args, { stdio: "inherit" });
run("scripts/install-compact.mjs");
run("scripts/compile.mjs", "--skip-zk");
run("scripts/compile.mjs", "--lifecycle", "--skip-zk");
run("integrations/issuance/compile.mjs");
// Constraint-only builds support issuance. Never claim hosted proofs from them.
// Full keys are generated only for an explicitly selected proving build.
if (process.env.VEILPASS_BUILD_PROOFS === "1") {
  run("integrations/issuance/compile.mjs", "--authorization", "--proofs");
  mkdirSync("docs/evidence", { recursive: true });
  run("scripts/signed-artifacts.mjs");
  run("scripts/signed-assets.mjs");
} else run("integrations/issuance/compile.mjs", "--authorization");
run("node_modules/next/dist/bin/next", "build", "apps/web");
