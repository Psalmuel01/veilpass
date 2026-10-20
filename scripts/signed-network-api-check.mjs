// HTTP boundary regression using generated state, not a real network or proof.
import {
  Contract,
  pureCircuits,
} from "../integrations/issuance/managed-authorization/contract/index.js";
import { witnessesV3 } from "../integrations/issuance/src/contract.ts";
import {
  IssuerAuthority,
  encodeWire,
} from "../integrations/issuance/src/index.ts";
import { label, hex, random32 } from "../integrations/issuance/src/crypto.ts";
import {
  createConstructorContext,
  ContractOperation,
} from "@midnight-ntwrk/compact-runtime";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(path.join(os.tmpdir(), "veilpass-v3-api-"));
const issuer = new IssuerAuthority(),
  trust = issuer.publicTrust(),
  domain = label("veilpass:api:v3"),
  appA = label("hackathon.example"),
  appB = label("community.example");
const contract = new Contract(witnessesV3);
const state = contract.initialState(
  createConstructorContext({}, "00".repeat(32)),
  trust.method,
  trust.publicKey,
  trust.registryId,
  random32(),
  pureCircuits.administratorKey(random32()),
  domain,
  appA,
  appB,
).currentContractState;
for (const name of ["authorize", "publishStatus", "deactivate"]) {
  const operation = new ContractOperation();
  operation.verifierKey = await readFile(
    `integrations/issuance/managed-authorization/keys/${name}.verifier`,
  );
  state.setOperation(name, operation);
}
const address = "ab".repeat(32);
const indexer = createServer(async (_req, res) => {
  await new Promise((r) => setTimeout(r, 1100));
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      data: {
        block: { height: 1, hash: "cd".repeat(32), timestamp: Date.now() },
        contractAction: {
          __typename: "ContractCall",
          address,
          state: hex(state.serialize()),
        },
      },
    }),
  );
});
await new Promise((resolve) => indexer.listen(0, "127.0.0.1", resolve));
const indexerPort = indexer.address().port,
  configFile = path.join(directory, "config.json");
await writeFile(
  configFile,
  encodeWire({
    network: "undeployed",
    contractAddress: address,
    domain: hex(domain),
    appA: hex(appA),
    appB: hex(appB),
    trust,
    indexerUri: `http://127.0.0.1:${indexerPort}`,
    indexerWsUri: `ws://127.0.0.1:${indexerPort}`,
    proofServer: "http://127.0.0.1:6300",
  }),
);
let output = "";
const origin = "http://127.0.0.1:3020";
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3020",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      VEILPASS_BUILD_DIR: ".next-signed-build",
      VEILPASS_SIGNED_NETWORK: "1",
      VEILPASS_SIGNED_NETWORK_CONFIG: configFile,
      VEILPASS_TEST_DIAGNOSTICS: "1",
    },
  },
);
server.stdout.on("data", (d) => (output += d));
server.stderr.on("data", (d) => (output += d));
try {
  for (let i = 0; i < 100; i++) {
    if (output.includes("Ready in")) break;
    if (server.exitCode !== null) throw Error(output);
    await new Promise((r) => setTimeout(r, 100));
  }
  const response = await fetch(`${origin}/api/signed-network`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "challenge", policy: 1 }),
  });
  if (!response.ok)
    throw Error(`HTTP ${response.status}: ${await response.text()}\n${output}`);
  const c = await response.json();
  assert.equal(c.version, 3);
  assert.equal(c.domain, hex(domain));
  assert.equal(c.audience, hex(appA));
  console.log(
    "PASS: V3 HTTP challenge, pinned generated state and durable store from Next app working directory. No network confirmation is claimed.",
  );
} finally {
  server.kill("SIGTERM");
  await new Promise((resolve) => {
    if (server.exitCode !== null) resolve();
    else {
      server.once("exit", resolve);
      setTimeout(() => {
        server.kill("SIGKILL");
        resolve();
      }, 5000).unref();
    }
  });
  await new Promise((resolve) => indexer.close(resolve));
  await rm(directory, { recursive: true, force: true });
  await rm(path.resolve(".private/signed-verifiers", address), {
    recursive: true,
    force: true,
  });
}
