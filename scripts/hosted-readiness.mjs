// Public, read-only smoke checks. Never logs response bodies or credentials.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const origin = new URL(process.env.VEILPASS_SMOKE_ORIGIN || 'https://useveilpass.vercel.app');
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)
  throw new Error('Smoke target must be an HTTPS origin');
const expected = process.env.VEILPASS_SMOKE_FINGERPRINT || '52552b8a73de3b266948ab0f080a00b415a9bc8228f20c51204da1087ee50ba8';
async function call(path, options) {
  let response;
  // Render Free may return HTML while waking up. Bound retries independently of body parsing.
  for (let attempt = 0; attempt < 6; attempt++) {
    response = await fetch(new URL(path, origin), { ...options, redirect: 'error', signal: AbortSignal.timeout(65000) }).catch(() => null);
    if (response?.headers.get('content-type')?.includes('application/json')) return response;
    await response?.body?.cancel();
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error(`JSON service unavailable at ${path}`);
}
const trust = await call('/api/issuance');
assert.equal(trust.status, 200, 'Issuer must be reachable');
const fingerprint = createHash('sha256').update(await trust.text()).digest('hex');
assert.equal(fingerprint, expected, 'Pinned issuer identity must match');
const unauthorized = await call('/api/issuance', { method: 'POST', headers: { origin: origin.origin, 'content-type': 'application/json' }, body: '{"action":"approve"}' });
assert.equal(unauthorized.status, 401, 'Unauthenticated administration must fail');
const forbidden = await call('/api/issuance', { method: 'POST', headers: { origin: 'https://attacker.invalid', 'content-type': 'application/json' }, body: '{"action":"approve"}' });
assert.equal(forbidden.status, 403, 'Untrusted mutation origin must fail');
const ready = await call('/api/readiness');
assert.equal(ready.status, 200, 'Issuer readiness must pass');
const readiness = await ready.json();
assert.equal(readiness.issuer, true);
assert.equal(readiness.database, true);
const result = { checkedAt: new Date().toISOString(), origin: origin.origin, publicIssuerFingerprint: fingerprint,
  issuer: true, pinnedIdentity: true, unauthorizedAdministrationRejected: true, untrustedOriginRejected: true,
  database: true, networkConfigured: readiness.networkConfigured === true, productionReady: readiness.productionReady === true,
  note: 'Read-only deployed smoke checks; no credential issuance, wallet, chain-proof or external-review claim.' };
if (process.env.VEILPASS_SMOKE_EVIDENCE) await writeFile(process.env.VEILPASS_SMOKE_EVIDENCE, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
