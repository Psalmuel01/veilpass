import "./check-node.mjs";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { decryptHolderBackup } from "../packages/holder-backup/index.ts";
const directory = await mkdtemp(path.join(os.tmpdir(), "veilpass-browser-"));
const token = randomBytes(48).toString("base64url");
const password = "browser-only test recovery passphrase";
const port = "3018",
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
      VEILPASS_ISSUER_DIRECTORY: directory,
      VEILPASS_ISSUER_STORAGE_KEY: randomBytes(48).toString("base64url"),
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
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error(output);
    if (output.includes("Ready in")) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    ...(process.env.VEILPASS_TEST_BROWSER === "chromium"
      ? {}
      : { channel: "chrome" }),
    headless: true,
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.clock.install();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  const sent = [];
  page.on("request", (r) => {
    if (r.method() === "POST") sent.push(r.postData() || "");
  });
  await page.goto(`${origin}/holder`);
  await page.locator("#holder-passphrase").fill(password);
  await page
    .getByRole("button", { name: "Create holder wallet", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your holder is unlocked" })
    .waitFor({ timeout: 30000 });
  const identity = await page.locator("#holder-identity").inputValue();
  const issuer = await context.newPage();
  await issuer.goto(`${origin}/issuer`);
  await issuer.locator("#issuer-token").fill(token);
  await issuer.locator("#issuer-identity").fill(identity);
  await issuer.locator("#issuer-level").selectOption("2");
  await issuer
    .getByRole("button", { name: "Approve holder enrollment" })
    .click();
  await issuer
    .locator("#issuer-offer")
    .waitFor({ timeout: 10000 })
    .catch(async (e) => {
      console.error(
        "Issuer UI:",
        await issuer.locator(".vp-alert-error").allTextContents(),
      );
      throw e;
    });
  const offer = await issuer.locator("#issuer-offer").inputValue();
  await page.locator("#holder-offer").fill(offer);
  await page.locator("#holder-passphrase").fill(password);
  await page.getByRole("button", { name: "Receive signed credential" }).click();
  await page
    .getByRole("heading", { name: "1 signed credential", exact: true })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Check signatures and eligibility locally" })
    .click();
  await page
    .getByLabel("Verification result")
    .waitFor({ timeout: 30000 });
  assert.match(
    await page.getByLabel("Verification result").innerText(),
    /approved-training/,
  );
  await page.getByRole("button", { name: "Test replay rejection" }).click();
  await page.locator(".vp-alert-error").waitFor();
  assert.match(await page.locator(".vp-alert-error").innerText(), /consumed/);
  await page.locator("#holder-policy").selectOption("2");
  await page
    .getByRole("button", { name: "Check signatures and eligibility locally" })
    .click();
  await page.getByLabel("Verification result").waitFor();
  assert.match(
    await page.getByLabel("Verification result").innerText(),
    /professional-level/,
  );
  await page
    .getByRole("button", { name: "Save encrypted browser vault" })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export encrypted backup" }).click();
  const download = await downloadEvent;
  const encrypted = await readFile(await download.path(), "utf8");
  const plain = JSON.parse(await decryptHolderBackup(encrypted, password));
  assert.equal(plain.credentials.length, 1);
  assert.equal(
    sent.join("").includes(plain.seed),
    false,
    "Signing seed left the browser",
  );
  const local = await page.evaluate(() =>
    localStorage.getItem("veilpass.signed-holder.v1"),
  );
  assert.equal(local, encrypted);
  assert.equal(local.includes(plain.seed), false);
  const credentialId = await page.locator(".vp-holder-reference").innerText();
  const id = credentialId.replace("Reference: ", "");
  await page.getByRole("button", { name: "Lock holder", exact: true }).click();
  await page.locator("#holder-passphrase").fill("incorrect recovery password");
  await page.getByRole("button", { name: "Unlock on this device" }).click();
  await page.locator(".vp-alert-error").waitFor();
  await page.reload();
  await page.locator("#holder-passphrase").fill(password);
  await page.getByRole("button", { name: "Unlock on this device" }).click();
  await page
    .getByRole("heading", { name: "1 signed credential", exact: true })
    .waitFor();
  await issuer.locator("#issuer-credential").fill(id);
  await issuer.getByRole("checkbox").check();
  await issuer
    .getByRole("button", { name: "Revoke credential", exact: true })
    .click();
  await issuer
    .getByRole("status")
    .filter({ hasText: "Credential revoked" })
    .waitFor();
  await page
    .getByRole("button", { name: "Check signatures and eligibility locally" })
    .click();
  await page.locator(".vp-alert-error").waitFor();
  assert.match(await page.locator(".vp-alert-error").innerText(), /revoked/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Mobile overflow",
  );
  const unauthorized = await page.evaluate(async () => {
    const response = await fetch("/api/issuance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deactivate" }),
    });
    return response.status;
  });
  assert.equal(unauthorized, 401);
  const csrf = await context.request.post(`${origin}/api/issuance`, {
    headers: {
      Origin: "https://outside.example",
      "Content-Type": "application/json",
    },
    data: { action: "deactivate" },
  });
  assert.equal(csrf.status(), 403);
  const wrongHost = await context.request.get(`${origin}/api/issuance`, {
    headers: { Host: "outside.example" },
  });
  assert.equal(wrongHost.status(), 503);
  const malformed = await context.request.post(`${origin}/api/issuance`, {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: "x".repeat(65537),
  });
  assert.equal(malformed.status(), 400);
  const noNetwork = await context.request.get(`${origin}/api/signed-network`);
  assert.equal(noNetwork.status(), 503);
  await page.clock.fastForward(300001);
  await page
    .getByRole("heading", { name: "Your private holder wallet", exact: true })
    .waitFor();
  assert.deepEqual(consoleErrors, []);
  console.log(
    "PASS: browser key creation, authenticated holder-bound issuance, both policies, replay rejection, encrypted save/export, recovery, revocation, mobile layout, unauthorized administration, CSRF/host/body guards, unconfigured network, idle lock, no signing seed in requests.",
  );
} catch (e) {
  console.error(output);
  throw e;
} finally {
  await browser?.close();
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
  await rm(directory, { recursive: true, force: true });
}
