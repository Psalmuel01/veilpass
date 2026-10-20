// Explicit operator acceptance: creates one synthetic credential, then revokes it.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { Holder, LocalVerifier, encodeWire, decodeWire } from "../integrations/issuance/src/index.js";
const [config, confirmation] = process.argv.slice(2);
if (!config || confirmation !== "--exercise-issuer") throw new Error("Usage: hosted-journey <private-env-file> --exercise-issuer");
const env = parseEnv(await readFile(config, "utf8"));
const origin = "https://useveilpass.vercel.app";
const token = env.VEILPASS_ISSUER_ADMIN_TOKEN;
if (!token || !env.VEILPASS_ISSUER_FINGERPRINT) throw new Error("Private operator configuration required");
async function call(body?: unknown, id?: string) {
  const response = await fetch(`${origin}/api/issuance${id ? `?id=${id}` : ""}`, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(65000),
    headers: { origin, "content-type": "application/json", ...(body ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: encodeWire(body) } : {}),
  });
  if (response.status !== 200 || !response.headers.get("content-type")?.includes("application/json"))
    throw new Error(`Hosted issuer returned HTTP ${response.status}; no response body logged`);
  return decodeWire(await response.text());
}
const holder = new Holder(); let credentialId: string | undefined; let revoked = false;
try {
  const trust = await call() as Parameters<Holder["accept"]>[1];
  assert.equal(createHash("sha256").update(encodeWire(trust)).digest("hex"), env.VEILPASS_ISSUER_FINGERPRINT);
  const offer = await call({ action: "approve", level: 2, holder: holder.publicIdentity() }) as Parameters<Holder["request"]>[0];
  const credential = await call({ action: "issue", request: holder.request(offer) }) as Parameters<Holder["accept"]>[0];
  credentialId = holder.accept(credential, trust);
  const status = await call(undefined, credentialId) as ReturnType<ConstructorParameters<typeof LocalVerifier>[0]["read"]>;
  for (const policy of [1, 2] as const) {
    const verifier = new LocalVerifier({ trust, read: () => status }, `hosted-acceptance-${policy}`, `acceptance-${policy}.veilpass`, policy);
    assert.equal(verifier.verify(holder.present(credentialId, verifier.challenge())).valid, true);
  }
  await call({ action: "revoke", id: credentialId }); revoked = true;
  const after = await call(undefined, credentialId) as { revoked: boolean };
  assert.equal(after.revoked, true);
  const result = { checkedAt: new Date().toISOString(), origin, signedIssuance: true, holderOwnership: true,
    localPolicyChecks: [1, 2], revocation: true, syntheticCredentialRevoked: true, networkProof: false,
    note: "Actual hosted issuer journey; private holder keys remained in the acceptance process. No installed-wallet, browser-recovery, chain-proof or external-pilot claim." };
  await writeFile("docs/evidence/hosted-journey.json", JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally {
  try { if (credentialId && !revoked) await call({ action: "revoke", id: credentialId }); }
  finally { holder.lock(); }
}
