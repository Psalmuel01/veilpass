// Ephemeral proof-backed V3 deployment. Never uses a real wallet or Preprod.
import "./check-node.mjs";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import { WebSocket } from "ws";
import {
  logger,
  LocalTestConfiguration,
  MidnightWalletProvider,
  initializeMidnightProviders,
} from "@midnight-ntwrk/testkit-js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js/network-id";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract } from "@midnight-ntwrk/midnight-js/contracts";
import {
  Contract,
  ledger,
  pureCircuits,
} from "../integrations/issuance/managed-authorization/contract/index.js";
import {
  witnessesV3,
  type PrivateStateV3,
} from "../integrations/issuance/src/contract.js";
import { IssuerAuthority, Holder } from "../integrations/issuance/src/index.js";
import { label, random32, hex } from "../integrations/issuance/src/crypto.js";
import { ActiveStatusTree } from "../integrations/issuance/src/status-tree.js";
import { SignedMidnightAdapter } from "../integrations/issuance/src/midnight-adapter.js";
import {
  createSignedVerifier,
  fromHex,
} from "../integrations/issuance/src/verifier.js";
import { SqliteChallengeStore } from "../integrations/issuance/src/challenge-store.js";
import { memoryPrivateStateProvider } from "../packages/credential/memory-provider.js";
import assert from "node:assert/strict";
globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
process.env.MN_TEST_ENVIRONMENT = "undeployed";
logger.level = "silent";
setNetworkId("undeployed");
const project = `veilpass-v3-${process.pid}`,
  env = { ...process.env, TESTCONTAINERS_UID: `v3-${process.pid}` };
const compose = (...args: string[]) =>
  execFileSync(
    "docker",
    ["compose", "-p", project, "-f", "compose.local.yaml", ...args],
    {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 240000,
    },
  );
try {
  execFileSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    stdio: "ignore",
    timeout: 15000,
  });
} catch {
  throw new Error(
    "Docker engine is unavailable. Start Docker Desktop and wait for it to become ready before running the local network test.",
  );
}
const issuer = new IssuerAuthority(),
  holder = new Holder(),
  admin = random32(),
  trust = issuer.publicTrust();
const q = issuer.issue(
    holder.request(issuer.approve(2, holder.publicIdentity())),
  ),
  id = holder.accept(q, trust);
const tree = new ActiveStatusTree(issuer.statusEntries());
const domain = label("veilpass:signed:v3"),
  appA = label("hackathon.example"),
  appB = label("community.example");
const initialChallenge = {
  domain,
  audience: appA,
  policy: 1n,
  challenge: random32(),
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 300),
};
const initialPrivate: PrivateStateV3 = {
  witness: holder.present(id, initialChallenge),
  path: tree.path(id),
  admin,
};
const assets = path.resolve("integrations/issuance/managed-authorization");
const compiled = CompiledContract.make("veilpass-signed-v3", Contract).pipe(
  CompiledContract.withWitnesses(witnessesV3),
  CompiledContract.withCompiledFileAssets(assets),
);
let wallet: MidnightWalletProvider | undefined;
const stores: SqliteChallengeStore[] = [];
try {
  for (const op of ["authorize", "publishStatus", "deactivate"])
    assert(
      (await readFile(`${assets}/keys/${op}.verifier`)).length > 0,
      "Compile V3 proofs first",
    );
  console.log("Starting disposable Midnight node, indexer and prover...");
  await mkdir(".cache/proof-server", { recursive: true });
  compose("up", "-d", "--pull", "never", "--wait", "--wait-timeout", "180");
  const port = (service: string, internal: string) =>
    Number(compose("port", service, internal).trim().split(":").pop());
  const config = new LocalTestConfiguration({
    node: port("node", "9944"),
    indexer: port("indexer", "8088"),
    proofServer: port("proof-server", "6300"),
  });
  let ready = false;
  for (let n = 0; n < 300; n++) {
    try {
      if ((await fetch(`${config.proofServer}/version`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(ready, "Prover failed to start");
  console.log("Synchronizing disposable funded wallet...");
  wallet = await MidnightWalletProvider.build(
    pino({ level: "silent" }),
    config,
    "0000000000000000000000000000000000000000000000000000000000000002",
  );
  await wallet.start();
  if (process.env.VEILPASS_SIGNED_BROWSER === "only") {
    const browser = await (
      await import("./signed-browser-e2e.js")
    ).signedBrowserAcceptance(wallet, config);
    await writeFile(
      "docs/evidence/signed-browser-network.json",
      JSON.stringify(
        {
          recordedAt: new Date().toISOString(),
          mode: "confirmed-midnight-v3",
          network: "undeployed",
          ...browser,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      "PASS: browser-owned holder, authenticated issuance, both actual policy proofs, replay and revocation.",
    );
  } else {
    const base = initializeMidnightProviders<
      "authorize" | "publishStatus" | "deactivate",
      PrivateStateV3
    >(wallet, config, { privateStateStoreName: project, zkConfigPath: assets });
    const privateStates = memoryPrivateStateProvider<PrivateStateV3>();
    const providers = {
      ...base,
      privateStateProvider: privateStates,
      proofProvider: {
        async proveTx(...args: Parameters<typeof base.proofProvider.proveTx>) {
          console.log("Generating actual V3 proof...");
          return base.proofProvider.proveTx(...args);
        },
      },
    };
    const deployed = await deployContract(providers, {
      compiledContract: compiled,
      privateStateId: "holder",
      initialPrivateState: initialPrivate,
      args: [
        trust.method,
        trust.publicKey,
        trust.registryId,
        tree.root(),
        pureCircuits.administratorKey(admin),
        domain,
        appA,
        appB,
      ],
    });
    const address = deployed.deployTxData.public.contractAddress;
    console.log("V3 deployment confirmed:", address);
    const verifierKeys = {
      authorize: await readFile(`${assets}/keys/authorize.verifier`),
      publishStatus: await readFile(`${assets}/keys/publishStatus.verifier`),
      deactivate: await readFile(`${assets}/keys/deactivate.verifier`),
    };
    const chain = new SignedMidnightAdapter({
      indexerUrl: config.indexer,
      contractAddress: address,
      networkDomain: hex(domain),
      trust,
      verifierKeys,
    });
    const verifiers = [appA, appB].map((app, index) => {
      const store = new SqliteChallengeStore(
        path.resolve(".private", project, String(index)),
      );
      stores.push(store);
      return createSignedVerifier({
        audience: hex(app),
        domain: hex(domain),
        contractAddress: address,
        policy: index === 0 ? 1 : 2,
        store,
        chain,
      });
    });
    const transactions: string[] = [],
      presentations: {
        version: 3;
        challengeId: string;
        transactionReference: string;
      }[] = [];
    for (let i = 0; i < 2; i++) {
      const c = await verifiers[i].createChallenge(300);
      const witness = holder.present(id, {
        domain,
        audience: fromHex(c.audience),
        policy: BigInt(c.policy),
        challenge: fromHex(c.nonce),
        expiresAt: BigInt(c.expiresAt),
      });
      await privateStates.set("holder", {
        witness,
        path: tree.path(id),
        admin,
      });
      // Lower bound is public request time, with private credential dates checked
      // against the whole window. No private exact expiry enters the transcript.
      const lower = witness.proof.createdAt;
      const accepted = await deployed.callTx.authorize(
        fromHex(c.audience),
        BigInt(c.policy),
        fromHex(c.nonce),
        lower,
        BigInt(c.expiresAt),
      );
      assert.equal(accepted.public.status, "SucceedEntirely");
      const p = {
        version: 3 as const,
        challengeId: c.id,
        transactionReference: accepted.public.txId,
      };
      assert.equal((await verifiers[i].verify(p)).eligible, true);
      await assert.rejects(verifiers[i].verify(p), /consumed/);
      const encoded = hex(accepted.public.tx.serialize());
      assert(
        !encoded.includes(
          hex(q.credential.statusBinding.statusHandleCommitment),
        ),
        "Status handle leaked into public transaction",
      );
      assert(
        !encoded.includes(hex(q.credential.claimRoot)),
        "Private claims root leaked into public transaction",
      );
      presentations.push(p);
      transactions.push(accepted.public.txId);
    }
    issuer.revoke(id);
    const revoked = new ActiveStatusTree(issuer.statusEntries());
    const update = await deployed.callTx.publishStatus(revoked.root());
    assert.equal(update.public.status, "SucceedEntirely");
    await assert.rejects(
      verifiers[1].verify(presentations[1]),
      /Status changed/,
    );
    const c = await verifiers[0].createChallenge(300),
      witness = holder.present(id, {
        domain,
        audience: appA,
        policy: 1n,
        challenge: fromHex(c.nonce),
        expiresAt: BigInt(c.expiresAt),
      });
    await privateStates.set("holder", {
      witness,
      path: revoked.path(id),
      admin,
    });
    await assert.rejects(
      deployed.callTx.authorize(
        appA,
        1n,
        fromHex(c.nonce),
        witness.proof.createdAt,
        BigInt(c.expiresAt),
      ),
      /not active/,
    );
    const current =
      await providers.publicDataProvider.queryContractState(address);
    assert(current && ledger(current.data).statusVersion === 1n);
    const browser =
      process.env.VEILPASS_SIGNED_BROWSER === "1"
        ? await (
            await import("./signed-browser-e2e.js")
          ).signedBrowserAcceptance(wallet, config)
        : undefined;
    const evidence = {
      ...(browser ? { browser } : {}),
      recordedAt: new Date().toISOString(),
      mode: "confirmed-midnight-v3",
      network: "undeployed",
      contractAddress: address,
      deploymentTransaction: deployed.deployTxData.public.txId,
      authorizationTransactions: transactions,
      revocationTransaction: update.public.txId,
      twoPoliciesVerified: true,
      sdkReplayRejected: true,
      revokedCredentialRejected: true,
      oldReceiptRejectedAfterStatusChange: true,
      statusHandleAndClaimsRootAbsentFromPublicTransaction: true,
      note: "Disposable local network. Not Preprod. Holder signing seed never enters proof witnesses.",
    };
    await writeFile(
      "docs/evidence/signed-network.json",
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(
      "PASS: actual V3 proofs, two policies, pinned verifier, durable replay protection and revocation.",
    );
  }
} finally {
  for (const s of stores) s.close();
  holder.lock();
  if (wallet) await wallet.stop();
  compose("down", "--volumes");
  await rm(path.resolve(".private", project), { recursive: true, force: true });
}
