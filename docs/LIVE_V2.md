# Live V2 browser verification

The `/live` page is separate from the generated-execution `/lifecycle` workbench.
It imports a V2 qualification in browser memory, requests a server-issued challenge,
generates a real proof through a loopback prover, asks the connected wallet to
balance/submit the transaction, waits for confirmed state and submits only a
challenge ID and transaction identifier to the server-side SDK.

## Easiest local demonstration

Prerequisites: Node 22.22.0, Docker Desktop running, Google Chrome, dependencies,
pinned compiler, compiled legacy/V2 bindings and V2 proof assets.

```sh
nvm use
npm ci
npm run toolchain:install
npm run contract:check
npm run lifecycle:compile
npm run demo:live
```

The command starts a disposable local Midnight node/indexer/prover, synchronizes a
funded development wallet, deploys the V2 issuer batch and opens Chrome on port
3006. It loads a sample qualification and connects the funded wallet through the
real testkit connector bridge. This bridge transports wallet methods; it does not
fabricate proofs, balances, submissions, confirmations or SDK results. It is not an
installed Lace/other wallet-extension test.

Choose a policy; press **Request live challenge → Generate and submit proof →
Verify confirmed authorization**. Both policies accept the same level 2 credential.
Verify again to exercise durable replay rejection. Request a new challenge for a
new attempt; each challenge lasts five minutes. The local prover receives the
private witness. Close the launched Chrome window to dispose the demo chain.
Do not stop Docker Desktop during the run.

If Docker Desktop's credential helper blocks public image downloads, use the
isolated Docker configuration documented in DEPLOYMENT.md. The current workspace has an isolated anonymous configuration at `.cache/docker-config`; it can be recreated using the JSON in DEPLOYMENT.md. On this macOS setup:

```sh
DOCKER_CONFIG="$PWD/.cache/docker-config" \
DOCKER_HOST="unix://$HOME/.docker/run/docker.sock" npm run demo:live
```

The temporary Docker configuration is machine-specific, not a repository dependency.

## Automated real-chain browser test

```sh
npm run test:live:browser
```

The command first builds the application and starts an isolated production server from `.next-live-demo` (separate from the ordinary preview build), avoiding development hot-reload interference during proofs. The harness exercises the server SDK against real confirmed transactions, its
one-use consumption, and status changes. Chrome then imports a credential,
connects the funded local wallet, generates real proofs for both policies, obtains
confirmed SDK results, rejects replay, and rejects the earlier receipt after the
issuer's real revocation. It checks mobile overflow and captures screenshots.
The evidence file is written only after the complete lifecycle succeeds.
A prior successful record is not overwritten by a failed run.

`npm run test:lifecycle:e2e` runs the real contract and SDK path without Chrome.
Unit adapter regression tests use small public verifier-key fixtures and generated
states; they are not network proof tests.

## Use an existing deployment and installed wallet

1. Deploy the exact bounded V2 contract with its three matching verifier keys.
2. Save **public fields only** to `.private/lifecycle-public.json`, or point
   `VEILPASS_LIVE_CONFIG` at an absolute JSON file path:

```json
{
  "network": "undeployed or preprod",
  "contractAddress": "actual 32-byte lowercase hex address",
  "root": "actual credential batch root, 32-byte lowercase hex",
  "domain": "deployed networkDomain, 32-byte lowercase hex",
  "appA": "deployed hackathonAudience, 32-byte lowercase hex",
  "appB": "deployed communityAudience, 32-byte lowercase hex",
  "indexerUri": "operator-trusted indexer GraphQL HTTP URL",
  "indexerWsUri": "matching websocket URL",
  "proofServer": "http://127.0.0.1:6300"
}
```

These are explanatory placeholders, not runnable deployment values. No address,
transaction or network evidence is fabricated. This file must not contain holder
credentials, administrator secrets or wallet seeds. The GET API returns only the
explicit public whitelist.

3. Compile the exact deployed contract's proof artifacts. The browser loads
   `/zk-lifecycle`; the verifier independently pins the three local `.verifier`
   artifacts in `contracts/lifecycle/managed/keys`. Package these assets with the
   server; an app-only standalone export without them is insufficient.
4. Deliver the matching qualification JSON privately to its holder. Start Next,
   visit `/live`, paste/import it, discover an installed connector-v4 wallet,
   connect on the configured network and complete the three verification steps.
5. Keep the configured indexer/prover and chain available. Existing ephemeral E2E
   addresses stop working when their disposable chains are destroyed.

No Preprod deployment, production issuer onboarding, or installed-wallet acceptance
is implied by the local testkit run. The normal preview shows an explicit
unconfigured state if there is no live deployment file.

## What the chain adapter verifies

`packages/sdk/midnight-adapter.ts` queries only the operator-configured indexer.
It requires the exact versioned transaction identifier, overall `SUCCESS`, and
exactly one `authorize` call at the pinned contract in that transaction. It pins
all three circuit verification keys and rejects extra operation entry points,
wrong root/domain, unavailable or malformed state and ambiguous action sequences.

To bind the transaction to a challenge, it deserializes the confirmed transaction,
checks its identifier and exact contract call, and extracts the public request-key
insertion from the pinned Compact 0.31.1 VM transcript. It recognizes the typed
`consumed` map insertion at ledger field 11, rather than searching transaction bytes
for a holder-supplied substring. It checks that the same key is in the indexed
post-action state. Unknown/ambiguous transcript formats fail closed. This prevents
a later unrelated authorization from claiming an earlier request. The typed parser
is deliberately compiler/schema-specific and must be reviewed when those change.
Transactions with multiple calls at the same V2 contract are rejected by this
bounded adapter. The contract's consumed state grows with requests; scalable status
and history design remain future work.

Current state comes from the canonical indexer and reports the indexed chain-head
time as `observedAt`, rather than stamping a stale response with the server's clock.
The SDK enforces its state-age bound, challenge expiry, root/status consistency and
atomic durable consumption. Actual Midnight transaction identifiers are 33-byte,
version-prefixed hex; sample references remain 32-byte hex. The live adapter accepts
only the pinned ledger's current versioned format.

The configured indexer is a trust boundary: this is not an independent node/light
client or cryptographic finality verifier. It relies on canonical/indexed chain
acceptance as the pinned MidnightJS provider does. Status can change between
observation and the application's next action; no verifier can retroactively revoke
an unrelated session token. Local file challenge storage is single-host. The local
API requires same-origin loopback writes, a bounded request body and request limits;
public multi-tenant hosting needs a separate production service design.

## Still next

Official signed credential integration, holder-owned keys/recovery, scalable
issuance/status, general issuer management, Preprod operation and external pilot.
The two reference application pages remain explicitly generated-execution examples;
`/live` is the separate real proof-backed path and supports either pinned policy.

## Primary references

The implementation uses the repository's pinned MidnightJS 4.1.1 declarations,
ledger 8.1.0 bindings, generated Compact 0.31.1 code, and
[Midnight's deployment/provider guide](https://docs.midnight.network/guides/deploy-and-operate).
The [official indexer source](https://github.com/midnightntwrk/midnight-indexer)
clarifies its historical-offset semantics. The pinned v3 contractAction block
lookup returns an action from that exact block, so the adapter uses transaction
transcripts instead of assuming an as-of historical lookup.
