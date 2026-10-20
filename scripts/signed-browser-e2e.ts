// Actual browser-owned holder, actual proofs, disposable connector wallet.
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir, cp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import pino from "pino";
import {
  DAppConnectorWalletAdapter,
  initializeMidnightProviders,
  type MidnightWalletProvider,
  type EnvironmentConfiguration,
} from "@midnight-ntwrk/testkit-js";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { deployContract } from "@midnight-ntwrk/midnight-js/contracts";
import {
  Contract,
  pureCircuits,
} from "../integrations/issuance/managed-authorization/contract/index.js";
import {
  witnessesV3,
  type PrivateStateV3,
} from "../integrations/issuance/src/contract.js";
import { withIssuer } from "../integrations/issuance/src/service.js";
import { encodeWire } from "../integrations/issuance/src/wire.js";
import { ActiveStatusTree } from "../integrations/issuance/src/status-tree.js";
import { label, random32, hex } from "../integrations/issuance/src/crypto.js";
import { memoryPrivateStateProvider } from "../packages/credential/memory-provider.js";
export async function signedBrowserAcceptance(
  wallet: MidnightWalletProvider,
  config: EnvironmentConfiguration,
) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "veilpass-signed-network-browser-"),
  );
  const authority = path.join(directory, "issuer"),
    configFile = path.join(directory, "deployment.json");
  const storageKey = randomBytes(48).toString("base64url"),
    token = randomBytes(48).toString("base64url");
  const admin = random32(),
    domain = label("veilpass:browser:v3"),
    appA = label("hackathon.example"),
    appB = label("community.example");
  const assets = path.resolve("integrations/issuance/managed-authorization");
  await mkdir("apps/web/public/zk-signed", { recursive: true });
  for (const sub of ["keys", "zkir"])
    await cp(
      path.join(assets, sub),
      path.join("apps/web/public/zk-signed", sub),
      { recursive: true },
    );
  const port = "3019",
    origin = `http://127.0.0.1:${port}`;
  let output = "";
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "apps/web",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        VEILPASS_BUILD_DIR: ".next-signed-build",
        VEILPASS_SIGNED_ISSUANCE: "1",
        VEILPASS_SIGNED_NETWORK: "1",
        VEILPASS_SIGNED_NETWORK_CONFIG: configFile,
        VEILPASS_TEST_DIAGNOSTICS: "1",
        VEILPASS_ISSUER_DIRECTORY: authority,
        VEILPASS_ISSUER_STORAGE_KEY: storageKey,
        VEILPASS_ISSUER_ADMIN_TOKEN: token,
      },
    },
  );
  server.stdout.on("data", (d) => {
    output += d;
  });
  server.stderr.on("data", (d) => {
    output += d;
  });
  let browser;
  let deployedAddress: string | undefined;
  try {
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(output);
      if (output.includes("Ready in")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const adapter = new DAppConnectorWalletAdapter(wallet, config);
    let changedNetwork = false;
    await page.exposeFunction(
      "veilpassV3Wallet",
      async (method: string, args: unknown[]) => {
        if (method === "getConfiguration") {
          const actual = await adapter.getConfiguration();
          return changedNetwork ? { ...actual, networkId: "preprod" } : actual;
        }
        if (method === "getShieldedAddresses")
          return adapter.getShieldedAddresses();
        if (method === "balanceUnsealedTransaction")
          return adapter.balanceUnsealedTransaction(String(args[0]));
        if (method === "submitTransaction")
          return adapter.submitTransaction(String(args[0]));
        throw Error("Unsupported wallet method");
      },
    );
    await page.addInitScript(
      `const connected={}; for(const m of ['getConfiguration','getShieldedAddresses','balanceUnsealedTransaction','submitTransaction']) connected[m]=(...args)=>window.veilpassV3Wallet(m,args); window.midnight={test:{name:'Disposable V3 wallet',connect:async()=>connected}};`,
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const password = "real browser holder recovery passphrase";
    await page.goto(`${origin}/holder`);
    await page.locator("#holder-passphrase").fill(password);
    await page
      .getByRole("button", { name: "Create holder wallet", exact: true })
      .click();
    await expect(page.locator("#holder-identity")).toBeVisible({
      timeout: 30000,
    });
    const identity = await page.locator("#holder-identity").inputValue();
    const issuer = await browser.newPage();
    await issuer.goto(`${origin}/issuer`);
    await issuer.locator("#issuer-token").fill(token);
    await issuer.locator("#issuer-identity").fill(identity);
    await issuer.locator("#issuer-level").selectOption("2");
    await issuer
      .getByRole("button", { name: "Approve holder enrollment" })
      .click();
    await expect(issuer.locator("#issuer-offer")).toBeVisible({
      timeout: 30000,
    });
    await page
      .locator("#holder-offer")
      .fill(await issuer.locator("#issuer-offer").inputValue());
    await page.locator("#holder-passphrase").fill(password);
    await page
      .getByRole("button", { name: "Receive signed credential" })
      .click();
    await expect(
      page.getByRole("heading", { name: "1 signed credential", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const id = (
      await page.locator(".vp-holder-reference").first().innerText()
    ).replace("Reference: ", "");
    const state = await withIssuer(authority, storageKey, (i) => ({
      trust: i.publicTrust(),
      entries: i.statusEntries(),
    }));
    const tree = new ActiveStatusTree(state.entries);
    const compiled = CompiledContract.make("veilpass-signed-v3", Contract).pipe(
      CompiledContract.withWitnesses(witnessesV3),
      CompiledContract.withCompiledFileAssets(assets),
    );
    const providers = {
      ...initializeMidnightProviders<
        "authorize" | "publishStatus" | "deactivate",
        PrivateStateV3
      >(wallet, config, {
        privateStateStoreName: `browser-v3-${process.pid}`,
        zkConfigPath: assets,
      }),
      privateStateProvider: memoryPrivateStateProvider<PrivateStateV3>(),
    };
    // Deployment and administration never access holder witnesses or signing seeds.
    const deployed = await deployContract(providers, {
      compiledContract: compiled,
      privateStateId: "admin",
      initialPrivateState: { admin } as PrivateStateV3,
      args: [
        state.trust.method,
        state.trust.publicKey,
        state.trust.registryId,
        tree.root(),
        pureCircuits.administratorKey(admin),
        domain,
        appA,
        appB,
      ],
    });
    const address = deployed.deployTxData.public.contractAddress;
    deployedAddress = address;
    await writeFile(
      configFile,
      encodeWire({
        network: "undeployed",
        contractAddress: address,
        domain: hex(domain),
        appA: hex(appA),
        appB: hex(appB),
        indexerUri: config.indexer,
        indexerWsUri: config.indexerWS,
        proofServer: config.proofServer,
        trust: state.trust,
      }),
      { mode: 0o600 },
    );
    const publicState =
      await providers.publicDataProvider.queryContractState(address);
    if (!publicState) throw new Error("Deployment state missing");
    await mkdir(".cache/signed-debug", { recursive: true });
    await writeFile(
      ".cache/signed-debug/public.json",
      encodeWire({
        address,
        serialized: hex(publicState.serialize()),
        trust: state.trust,
        domain: hex(domain),
        appA: hex(appA),
        appB: hex(appB),
      }),
    );
    await page
      .getByText("Proof-backed V3 verification", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Load network and discover wallets" })
      .click();
    await page
      .getByRole("button", { name: "Connect Disposable V3 wallet" })
      .click();
    await expect(
      page.getByText("Connected: Disposable V3 wallet", { exact: true }),
    ).toBeVisible();
    const references: string[] = [];
    for (const policy of ["1", "2"]) {
      await page.locator("#holder-policy").selectOption(policy);
      if (policy === "1") {
        changedNetwork = true;
        await page
          .getByRole("button", { name: "Generate V3 network authorization" })
          .click();
        await expect(page.locator(".vp-alert-error")).toContainText(
          "Wallet network changed",
        );
        changedNetwork = false;
      }
      console.log(
        `Browser-owned holder: generating actual policy ${policy} proof...`,
      );
      await page
        .getByRole("button", { name: "Generate V3 network authorization" })
        .click();
      await Promise.race([
        page
          .getByRole("button", { name: "Verify confirmed transaction" })
          .waitFor({ timeout: 300000 }),
        page
          .locator(".vp-alert-error")
          .waitFor({ timeout: 300000 })
          .then(async () => {
            throw Error(await page.locator(".vp-alert-error").innerText());
          }),
      ]);
      await page
        .getByRole("button", { name: "Verify confirmed transaction" })
        .click();
      await expect(page.getByLabel("Verification result")).toContainText(
        "confirmed-midnight-v3",
        { timeout: 30000 },
      );
      if (policy === "2") {
        await mkdir("docs/screenshots/signed", { recursive: true });
        await page.evaluate(() =>
          scrollTo({ top: 0, left: 0, behavior: "instant" }),
        );
        await page.screenshot({
          path: "docs/screenshots/signed/confirmed-light.png",
          fullPage: true,
          animations: "disabled",
        });
        await page
          .getByRole("button", { name: "Dark mode", exact: true })
          .click();
        await page.evaluate(() =>
          scrollTo({ top: 0, left: 0, behavior: "instant" }),
        );
        await page.screenshot({
          path: "docs/screenshots/signed/confirmed-dark.png",
          fullPage: true,
          animations: "disabled",
        });
      }
      references.push(
        JSON.parse(await page.getByLabel("Verification result").innerText())
          .verificationReference,
      );
      await page
        .getByRole("button", { name: "Verify confirmed transaction" })
        .click();
      await expect(page.locator(".vp-alert-error")).toContainText("rejected");
    }
    await withIssuer(authority, storageKey, (i) => i.revoke(id));
    const entries = await withIssuer(authority, storageKey, (i) =>
      i.statusEntries(),
    );
    const revocation = await deployed.callTx.publishStatus(
      new ActiveStatusTree(entries).root(),
    );
    assert.equal(revocation.public.status, "SucceedEntirely");
    await page
      .getByRole("button", { name: "Verify confirmed transaction" })
      .click();
    await expect(page.locator(".vp-alert-error")).toContainText("rejected");
    await page
      .getByRole("button", { name: "Generate V3 network authorization" })
      .click();
    await expect(page.locator(".vp-alert-error")).toContainText("not active", {
      timeout: 30000,
    });
    await mkdir("docs/screenshots/signed", { recursive: true });
    await page.evaluate(() =>
      scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    await page.screenshot({
      path: "docs/screenshots/signed/holder-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.evaluate(() =>
      scrollTo({ top: 0, left: 0, behavior: "instant" }),
    );
    await page.screenshot({
      path: "docs/screenshots/signed/holder-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    assert.deepEqual(errors, []);
    return {
      connector:
        "Disposable funded testkit wallet through browser connector bridge; not an installed extension",
      browserOwnedSigningKeys: true,
      authenticatedIssuance: true,
      twoPoliciesConfirmed: true,
      walletNetworkChangeRejected: true,
      replayRejected: true,
      revocationRejected: true,
      transactions: references,
      deploymentTransaction: deployed.deployTxData.public.txId,
      revocationTransaction: revocation.public.txId,
    };
  } catch (e) {
    console.error(output);
    throw e;
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (server.exitCode !== null) resolve();
      else {
        server.once("exit", resolve);
        setTimeout(() => {
          server.kill("SIGKILL");
          resolve();
        }, 5000).unref();
      }
    });
    await rm(directory, { recursive: true, force: true });
    if (deployedAddress)
      await rm(path.resolve(".private/signed-verifiers", deployedAddress), {
        recursive: true,
        force: true,
      });
  }
}
