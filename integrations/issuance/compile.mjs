// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
if (Number(process.versions.node.split(".")[0]) < 24)
  throw new Error(
    "The official credential integration requires Node 24 or later.",
  );
const directory = path.dirname(fileURLToPath(import.meta.url));
const compiler =
  process.env.COMPACTC || path.resolve(directory, "../../.toolchain/compactc");
if (
  execFileSync(compiler, ["--version"], { encoding: "utf8" }).trim() !==
  "0.31.1"
)
  throw new Error("Compact 0.31.1 is required.");
execFileSync(
  compiler,
  [
    ...(process.argv.includes("--proofs") ? [] : ["--skip-zk"]),
    path.join(directory, process.argv.includes("--authorization") ? "authorization.compact" : "qualification.compact"),
    path.join(directory, process.argv.includes("--authorization") ? "managed-authorization" : "managed"),
  ],
  { stdio: "inherit" },
);
