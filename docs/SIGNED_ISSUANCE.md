# Signed issuance, browser custody and V3 authorization

This implementation replaces issuer-known holder secrets with holder-generated signing keys in the new signed flow. V2 remains a separate, compatible historical sample flow.

## Start the signed browser workflow

From the repository root:

```sh
nvm install                     # first setup only
nvm use                         # Node 24.22.0
npm ci                          # one workspace lockfile; one Midnight WASM runtime
npm run toolchain:install       # first setup only
npm run signed:check
npm run dev:signed
```

Open `http://127.0.0.1:3018/holder` and `/issuer`. The developer launcher creates owner-only encrypted-service configuration under `.private/signed-issuer`. Run `npm run issuer:token` in a second terminal to obtain the local operator token; paste it only into `/issuer`. This token authenticates a single trusted operator. It is not institutional identity verification or a multi-user account system.

1. On `/holder`, enter a long vault passphrase and create a holder wallet. Export its encrypted backup. Share only the public enrollment identity with the issuer.
2. On `/issuer`, enter the operator token, paste that public identity, approve level 1 or 2, and return the short-lived offer to the holder. Offers are bound to the exact holder method and public key.
3. On `/holder`, paste the offer and enter the existing vault passphrase. Receive the credential. The holder signs the enrollment locally; the issuer signs the claims and public-key binding. Export/save the **updated** encrypted backup.
4. Check either policy locally. These checks execute genuine generated Compact signature constraints on the device; their receipts are explicitly `local-signed-credential`, not network authorizations.
5. Test replay rejection. Lock, reload and unlock from encrypted browser storage, or import the exported file. Recovery rechecks ownership and embedded signatures; verifier trust/current status are checked separately.
6. Revoke the reference in `/issuer` after confirming it. Fresh checks fail. Revocation and consumed enrollment offers survive server restarts.

Only encrypted backups are stored in localStorage, and saving there is explicit. Signing keys stay in session memory; five minutes without pointer/keyboard activity locks the holder. The shared recovery format uses PBKDF2-HMAC-SHA256 (600,000 iterations), AES-256-GCM, random salt/IV and authenticated purpose binding. Backups cannot reset forgotten passphrases or restore revoked eligibility.

## Authority storage and retry behavior

SQLite stores an encrypted authority snapshot including its issuer key, trusted registry, holder-bound pending offers, issued status records and short-lived retry receipts. Database and service-secret files are owner-only. Optimistic version updates prevent lost concurrent writes. A failed operation commits no state. Keep the storage key and database backed up together; losing the key loses the authority. The local authority caps issued records at 2,048; the separate V3 status tree supports 65,536 positions. This is a bounded pilot design.

Issuance transport retries can recover the same signed credential without adding a second record. Each retry must prove possession of the same approved holder key; revoked credentials cannot be recovered as active. The ordinary one-shot `issue` API still rejects replay.

The route requires explicit configuration, same-origin loopback POSTs, bounded JSON input, administration tokens and local request throttling. It is disabled on Vercel. Do not expose the developer server as a public issuer service.

## V3 proof-backed contract

`integrations/issuance/authorization.compact` is separately versioned from V2. It composes the official issuer/holder signature constraints, pinned issuer key/method and status registry, private active-status membership, two audience-specific policies, ledger-time request validity and on-chain replay protection.

A 16-level status tree commits active credential roots/handles. Revoked leaves are removed. Status handles, credential roots, paths and holder keys remain private witnesses in authorization; public state contains the shared tree root and status version. Publication of status changes requires the administrator secret, which is separate from the holder signing key. An administrator must publish updated roots on-chain: changing local SQLite state alone does not revoke an on-chain credential.

Credential dates are compared privately against a public request window; the ledger checks that window. Individual credential issuance/expiry dates are not passed directly into public time constraints. Root updates conservatively invalidate all earlier receipts, including receipts for unaffected credentials; those holders can make fresh proofs with new paths.

`SignedMidnightAdapter` pins all three V3 circuit keys and issuer/registry/domain. It parses an exact consumed-set insertion at the V3 ledger field, validates a successful canonical transaction, checks current indexed state and never accepts a holder-selected endpoint. `createSignedVerifier` accepts version 3 transaction references only, defaults to confirmed V3 network authorization and uses atomic durable challenge consumption. V2 verifier semantics are not reused for V3.

## Validate

```sh
npm test
npm run typecheck
npm test --workspace @veilpass/issuance
npm run typecheck --workspace @veilpass/issuance
VEILPASS_BUILD_DIR=.next-signed-build npm run build
npm run test:signed:ui
npm run authorization:compile --workspace @veilpass/issuance
npm run signed:assets
npm run test:signed:api           # generated state and delayed HTTP boundary, no ZK claim
npm run test:signed:network
npm run test:signed:browser       # includes actual browser-held signing and proofs
```

The browser check starts/stops its own production server and disposable encrypted database. It verifies actual browser signing, operator issuance, both policies, replay, recovery, revocation, mobile layout, unauthorized administration and absence of the holder seed from outgoing requests. Set `VEILPASS_TEST_BROWSER=chromium` to use Playwright's installed Chromium instead of Chrome.

The network check starts/removes a disposable local node/indexer/prover stack, uses a public disposable genesis wallet, deploys V3, generates real proofs and verifies confirmed transactions. Docker must already be running. Evidence is written only after a complete successful run. Local network evidence does not establish Preprod or installed-wallet acceptance.

## Remaining production gates

Installed-wallet acceptance, public Preprod compatibility/deployment, persistent hosted issuer/verifier operation, institutional account authorization, loss recovery/key rotation, independent review, accessibility review and a real issuer/two-application pilot remain separate acceptance gates. See [Preprod setup](PREPROD_SETUP.md). No production-readiness or independent-audit claim is made.

The full browser flow passed actual local-network proofs; see [browser evidence](evidence/signed-browser-network.json). The browser has wallet discovery, network consistency checks before balancing/submission, V3 proof generation and a separate retryable confirmed-transaction verification step. Forgetting the local wallet connection does not revoke permissions inside an extension. The full browser acceptance harness uses a disposable funded connector bridge, not a real installed extension.

For a configured local deployment, set `VEILPASS_SIGNED_NETWORK=1` and `VEILPASS_SIGNED_NETWORK_CONFIG` to a wire-encoded public deployment file (see `SignedNetworkConfig`). It contains the actual network/address, domain/audiences, public issuer trust and client-accessible indexer/prover URLs. URLs with access-token query strings are rejected rather than exposed to browsers; a hosted Blockfrost integration needs an appropriately authenticated server gateway or a deliberately scoped client access design. The network verifier separately pins generated V3 keys from the local operator's filesystem. Public proving assets belong under `/zk-signed`; the browser acceptance harness copies them for its disposable run.

After full compilation, `npm run signed:artifacts` records hashes. `npm run validate --workspace @veilpass/issuance -- --reuse-compiled` checks those source/generated-code hashes before reusing existing outputs, preserving proving keys while rerunning all module tests. The default validation path recompiles constraints and requires full proof compilation again before network tests.

Wallet interoperability regression tests cover global BigInt JSON hooks: the wire encoder normalizes native integers/bytes before JSON serialization. Verifier challenge freshness is measured after indexer responses, so a delayed fresh response cannot be rejected against an earlier timestamp.
