// Disposable container acceptance. Never run against the real hosted issuer.
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { Holder, LocalVerifier, encodeWire, decodeWire } from "../integrations/issuance/src/index.js";
if (process.env.NODE_ENV !== "test" || process.env.VEILPASS_TEST_DATABASE_LOCAL !== "1")
  throw new Error("Requires the isolated container test configuration");
const host = new URL(process.env.VEILPASS_PUBLIC_ORIGIN!).host;
async function call(body?: unknown, options: { id?: string; origin?: string; auth?: boolean; host?: string } = {}) {
  const bodyText = body ? encodeWire(body) : undefined;
  const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = httpRequest(`http://127.0.0.1:10000/api/issuance${options.id ? `?id=${options.id}` : ""}`, {
    method: body ? "POST" : "GET",
    headers: {
      host: options.host || host, origin: options.origin || process.env.VEILPASS_PUBLIC_ORIGIN!,
      "Content-Type": "application/json",
      ...(bodyText ? { "Content-Length": String(Buffer.byteLength(bodyText)) } : {}),
      ...(options.auth ? { authorization: `Bearer ${process.env.VEILPASS_ISSUER_ADMIN_TOKEN}` } : {}),
    },
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode!, text }));
      response.on("error", reject);
    });
    request.setTimeout(60000, () => request.destroy(new Error("Test request timed out")));
    request.on("error", reject);
    request.end(bodyText);
  });
  return { status: response.status, body: decodeWire(response.text) };
}
const holder = new Holder();
assert.equal((await call(undefined, { host: "attacker.example" })).status, 503);
assert.equal((await call({ action: "approve" }, { origin: "https://attacker.example", auth: true })).status, 403);
assert.equal((await call({ action: "approve" })).status, 401);
const trust = await call(); assert.equal(trust.status, 200, encodeWire(trust.body));
const offer = await call({ action: "approve", level: 2, holder: holder.publicIdentity() }, {
  auth: true, origin: process.env.VEILPASS_FRONTEND_ORIGIN || process.env.VEILPASS_PUBLIC_ORIGIN,
});
assert.equal(offer.status, 200);
const request = holder.request(offer.body as Parameters<Holder["request"]>[0]);
const issued = await call({ action: "issue", request }); assert.equal(issued.status, 200);
const id = holder.accept(issued.body as Parameters<Holder["accept"]>[0], trust.body as Parameters<Holder["accept"]>[1]);
const status = await call(undefined, { id }); assert.equal(status.status, 200);
const verifier = new LocalVerifier({ trust: trust.body as Parameters<Holder["accept"]>[1], read: () => status.body as ReturnType<ConstructorParameters<typeof LocalVerifier>[0]["read"]> }, "container-test", "container.example", 1);
assert.equal(verifier.verify(holder.present(id, verifier.challenge())).valid, true);
const revoked = await call({ action: "revoke", id }, { auth: true }); assert.equal(revoked.status, 200);
const afterRevocation = await call(undefined, { id });
assert.equal((afterRevocation.body as { revoked: boolean }).revoked, true);
holder.lock();
console.log("Hosted HTTP acceptance passed: exact host/origin, authentication, holder-signed issuance, encrypted Postgres state, eligibility and revocation. No chain proof claimed.");
