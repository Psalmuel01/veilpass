# VeilPass V2 — complete implementation summary

**Snapshot:** 19 October 2026, through implementation commit `6ed21fe`.
**Baseline:** `07a3bc1`; earlier work and history remain intact.
**Scope:** the current V2 workstream. The repository records these changes as Wave 3 preparation. They are not presented as proof of eligible in-wave development, a public deployment, or external adoption.

## What we have built

VeilPass has evolved from a single-purpose university eligibility demo into a developer/professional qualification prototype with a separate lifecycle contract, two application policies, challenge-bound authorization, revocation and issuer deactivation, a server-side verifier SDK, a rebuilt product interface, and a real proof-backed V2 browser flow.

The strongest demonstrated result is this: **the same developer qualification was used in Chrome to generate real Midnight proofs for both pinned policies; transactions were confirmed; the server SDK independently accepted them; replay was rejected; issuer revocation was confirmed; and the earlier receipt plus fresh authorization attempts were rejected afterward.**

That result uses a disposable local Midnight network and a funded testkit wallet through a connector bridge. It does not establish installed-wallet-extension acceptance or Preprod deployment. The generated-execution sandbox remains a separate, explicitly labeled workflow.

## 1. Preserved the existing proof-backed foundation

The original implementation already contained a two-leaf university credential batch, a private graduation-year predicate, application-scoped replay protection, a browser vault and Midnight provider integration. We audited and retained it rather than attributing it to the new V2 work.

During this workstream we:

- Recorded the baseline architecture, existing capabilities, risks and missing features.
- Preserved the original contract, credential model and repository history.
- Moved the original browser workflow from `/` to `/wallet` to make room for a dedicated public website.
- Restyled the wallet and updated its browser/network entrypoints.
- Reverified sample issuance, encrypted persistence, lock/unlock, incorrect-passphrase rejection, private-detail reveal/hide, missing-wallet feedback and mobile layout.

The retained vault uses AES-256-GCM with PBKDF2-SHA256 and 310,000 iterations. Only ciphertext persists in localStorage. This encryption was part of the baseline; it is not a newly introduced V2 feature. An unlocked browser and its local prover can access witnesses.

## 2. Implemented a separate V2 qualification lifecycle contract

Added `contracts/lifecycle/lifecycle.compact`, with a strict TypeScript qualification envelope, canonical encodings, witnesses and developer fixtures in `packages/lifecycle`.

The bounded V2 model includes:

- A constructor-pinned issuer and two-leaf credential batch root.
- A developer-training qualification with version, issuer, program, completion, level, issuance/expiry and holder-secret fields committed into its authenticity hash.
- Private Merkle sibling and leaf-direction witnesses.
- Shared batch validity constrained by actual ledger block time.
- A pinned network domain and two audience/policy pairs.
- Public revocation flags and issuer-active status.
- An administrator commitment authenticated by a private secret-preimage witness.

Two policies are implemented:

| Policy | Requirement |
|---|---|
| `approved-training` | Approved developer training, completed, level 1 or above |
| `professional-level` | The same approved training, completed, level 2 or above |

Both require an authentic, currently valid, non-revoked credential and active issuer. The policy/audience pair must match the deployment.

Authorization consumes a one-time request hash binding network domain, audience, policy, nonce and deadline. It contains no holder-derived universal identifier. The contract reads both revocation flags before selecting the relevant flag privately, avoiding publication of the credential's leaf position during authorization.

Administrator-authorized `revoke` and `deactivateIssuer` circuits are implemented. Revocation and deactivation are irreversible in this contract. Status changes and revocation actions still expose public metadata.

**Authenticity currently means issuer-pinned Merkle membership, not a signed verifiable credential.** The batch is fixed at two records, and sample secrets are issuer-known bearer material.

## 3. Built the server-side verifier SDK

Added the private, unpublished source package `@veilpass/sdk`.

Implemented:

- Typed V2 challenges and minimal presentations.
- Independent 256-bit random challenge IDs and nonces.
- Challenge lifetimes of 1–300 seconds; default 120 seconds and 300 seconds for the live flow.
- Binding to the configured audience, network domain, contract and policy.
- Server-time expiry checks before and after adapter I/O.
- Current issuer activity, batch validity, root and status checks.
- State freshness enforcement: 30 seconds by default, configurable up to 60 seconds.
- Conservative invalidation of historical authorizations after any observed batch status change.
- Explicit `confirmed-midnight` and `generated-execution` modes; confirmed mode is the default and rejects sandbox results.
- Canonical parsing of sample references and the pinned ledger's version-prefixed real transaction identifiers.
- Structured verifier errors and a minimal eligibility result without the credential payload or a universal holder identifier.

Added `FileChallengeStore` with owner-only files, exclusive creation, file/directory synchronization and atomic one-time consumption. Tests confirm that eight competing consumption attempts accept exactly one and that replay remains rejected after reopening the store.

This is single-host durable storage. Shared production deployment and atomic integration with an application's business transaction remain separate work.

## 4. Implemented the real Midnight chain adapter

Added `MidnightChainAdapter`, which uses an operator-configured indexer rather than holder-supplied endpoints or state.

The adapter:

- Pins the contract address, credential root and network domain.
- Pins all three deployed circuit verifier keys and rejects unexpected operation sets.
- Requires a successful indexed transaction and exactly one authorization action at the configured V2 contract.
- Deserializes the real ledger-v8 transaction and checks its identifier and contract call.
- Extracts the exact typed public consumed-request insertion from the pinned Compact VM transcript.
- Checks that this request key appears in the indexed post-action state.
- Reads current canonical contract status and uses the indexed chain-head time for freshness, rather than stamping stale data with the server's clock.
- Fails closed on malformed, missing, ambiguous, mismatched or stale evidence.

Integration resolved the real transaction-identifier version byte, exact-block historical lookup behavior, compact trailing-zero encoding and typed transcript binding. A captured public transaction/state fixture supports regression testing without regenerating transaction proofs.

The indexer remains a trust boundary; this is not an independent node or cryptographic light-client finality verifier. The transcript parser is tied to the pinned compiler/schema and requires review on upgrades. Multi-call transactions at the same V2 contract are deliberately rejected by this bounded adapter.

## 5. Added a real V2 browser flow at `/live`

The live flow now supports:

1. Importing and validating issuer-provided V2 qualification JSON.
2. Keeping the qualification in page memory, without adding plaintext credential persistence.
3. Discovering and connecting a connector-v4 Midnight wallet.
4. Checking the configured wallet network and deployment context.
5. Requesting a fresh server-issued challenge for either policy.
6. Generating a real proof through a holder-controlled loopback prover.
7. Wallet balancing/approval, submission and confirmation.
8. Independently verifying the confirmed authorization through the server SDK.
9. Displaying the real transaction reference, block and confirmed-mode eligibility receipt.
10. Showing pending stages, failures, replay rejection and recoverable network-change messages.

The verifier API receives challenge/policy/presentation context; it does not receive the imported credential. The local prover receives private witnesses. Refreshing clears the imported qualification.

Added `/api/live` with a public configuration whitelist, same-origin loopback write restrictions, bounded request bodies and request limits. Public service URLs containing credentials are rejected. Without deployment configuration, the page explicitly reports that it is unconfigured rather than manufacturing a successful result.

The ordinary preview and interactive/network demos use separate production build directories. The browser harness uses an isolated production server to avoid development hot-reload interference during proofs.

## 6. Built the lifecycle sandbox and reference integrations

The `/lifecycle` workspace provides an opt-in, developer-controlled session with:

- Sample qualification initialization and current credential status.
- Hackathon/community policy selection.
- Separate request, generated-constraint evaluation and SDK-verification steps.
- Challenge countdown, pending states and inspectable/copyable receipts.
- A level 1 sample that fails the professional policy.
- Replay rejection.
- Sample credential revocation and issuer deactivation controls.
- Session activity and links to the reference applications.

The workbench API uses same-origin loopback restrictions, an HttpOnly SameSite session cookie, streaming body bounds, session/action limits and one-hour expiry. Sample state survives development module reloads but expires on process restart; it is not a durable account system.

Added `/hackathon` and `/community`, each with a distinct reference experience using the real workbench API and SDK. Both accept the qualifying sample and reject fresh checks after revocation. They share the browser sandbox origin/session and are not independent external organizations.

Added `demo:verifiers`, which runs actual HTTP listeners on two origins with separate durable challenge stores and audience contexts. It exercises qualification reuse, cross-verifier substitution, replay, invalidation of pre-revocation authorization and fresh rejection after revocation. **It uses generated Compact execution, not transaction proofs.**

## 7. Rebuilt the product interface and appearance system

The product now has seven main pages:

| Route | Purpose |
|---|---|
| `/` | Public product website: workflow, privacy explanation, reference apps, SDK example, FAQ and app entry |
| `/lifecycle` | Generated-execution qualification workspace |
| `/live` | Real proof-backed V2 wallet/verifier flow |
| `/developers` | SDK, policy, security and live-setup portal |
| `/hackathon` | Hackathon reference application |
| `/community` | Professional-community reference application |
| `/wallet` | Preserved original proof-backed university wallet |

Implemented a shared ivory/ink/ultramarine visual system, custom code-native SVG branding, credential illustrations, clearer hierarchy, focused verification controls, status feedback, activity and receipts.

Added self-hosted Space Grotesk variable typography with its OFL license, retaining editorial serif accents. Added light/dark appearance across all product pages, including system defaults, remembered explicit preference, cross-tab synchronization, blocked-storage handling and a pre-hydration appearance initializer.

Responsive work includes mobile public navigation, a workspace drawer with focus containment and Escape dismissal, visible policy pressed states, focus indicators, reduced-motion support, improved contrast and long-label/receipt wrapping fixes. Tested widths include 360, 390, 480, 768 and 1440 pixels. A complete WCAG audit is not claimed.

## 8. Generated proof artifacts and validated the real network lifecycle

Generated six real proving/verification artifacts for `authorize`, `revoke` and `deactivateIssuer` using Compact 0.31.1/runtime 0.16.0. Recorded artifact sizes, SHA-256 hashes and contract-source hash in `docs/evidence/lifecycle-artifacts.json`. Generated assets are served through the V2 browser asset path.

The real local-network harness starts a node, indexer and prover, synchronizes a funded disposable wallet, deploys the V2 contract and validates its lifecycle. Image preparation and service readiness have separate bounds. An isolated anonymous Docker configuration resolves the observed Desktop credential-helper stall without changing existing Docker credentials/settings.

The latest successful evidence records:

- Real V2 deployment.
- Real Chrome-generated proofs for both pinned policies using the same qualification.
- Confirmed transactions and independent default-mode SDK acceptance.
- SDK and contract replay rejection.
- Confirmed issuer revocation.
- SDK rejection of the earlier authorization and fresh rejection under both policies.
- Cleanup of the disposable services.

The recorded contract address is `7c450647f315cab3d03073d216d145830d00fb4b9f81675bea4632bb503cbf8d`. Actual deployment, authorization and revocation transaction IDs are in `docs/evidence/lifecycle-network.json`, recorded at `2026-10-19T13:15:21.234Z`.

That chain was disposed. These references are evidence of a completed local run, not a currently live contract or public Preprod explorer entry. Desktop/mobile success and replay screenshots are in `docs/screenshots/live/`.

## 9. Expanded automated validation, security and measurement

The latest completed suite passed **50 tests across five files**:

| Coverage | Tests |
|---|---:|
| Original contract constraints | 12 |
| Vault, state and error behavior | 6 |
| V2 lifecycle constraints | 18 |
| SDK integration and durable consumption | 6 |
| Real wire-format adapter/transcript regressions | 8 |
| **Total** | **50** |

Coverage includes credential tampering, wrong issuer/program/context, inadequate level, invalid validity/challenge windows, unauthorized administration, irreversible status changes, unaffected second-record behavior, replay, concurrent consumption, persistence, stale state, wrong execution mode, substituted references, circuit-key mismatch, ambiguous calls and compact VM encoding.

Completed checks also include strict root/web TypeScript, production builds, original wallet browser acceptance, V2 sandbox browser acceptance, public/mobile navigation, two-origin HTTP integration, theme persistence, denied storage, cross-tab behavior, live API origin/body protections, and the real production-server browser/network lifecycle.

Dependency security updates include Next 15.5.28, Vitest 5.0.5/Vite 7.3.6, ws 8.22.0 and PostCSS 8.5.28. The latest recorded npm audit reports zero known advisories; this is a recorded audit result, not a claim of independent security certification or a newly rerun audit.

Recorded a 20-sample local generated-execution benchmark: constraint evaluation median about 18.7 ms/p95 20.8 ms; SDK verification including durable filesystem writes median about 10.8 ms/p95 16.1 ms. These are not ZK proving or confirmation timings. Real proving/confirmation latency, scalability, Lighthouse scores and production service levels have not been established.

## 10. Added documentation, provenance and reproducible workflows

The repository now includes baseline audit, architecture, privacy model, threat model, security, compatibility investigation, competitive analysis, SDK integration, deployment, live setup, performance, validation, feature/test status, UI redesign, pilot protocol, demo and submission-preparation guides, plus a changelog and machine-readable evidence.

New V2 additions are scoped under Apache-2.0 with license/NOTICE handling. Pre-existing and third-party rights remain applicable; the owner's earlier licensing provenance is not silently rewritten. The bundled font's OFL notice is retained.

Useful commands:

```sh
nvm use
npm test
npm run typecheck
npm run build
npm run lifecycle:check
npm run lifecycle:compile
npm run demo:verifiers
npm run test:lifecycle:e2e
npm run test:live:browser
npm run demo:live
```

Chrome and Docker are required for the real browser demo/tests. `test:live:browser` and `demo:live` build an isolated production application. The interactive demo opens Chrome with a loaded sample and connected funded local test wallet; closing its window disposes the chain. Existing-deployment setup and the machine-specific Docker workaround are in `docs/LIVE_V2.md`.

## What remains unfinished

- Official signed verifiable credentials and authenticated production issuance.
- Holder-owned keys, non-transferability, recovery and production custody.
- Scalable issuance/status beyond the two-record fixed batch.
- General issuer registry, administrative key rotation and policy builder.
- Acceptance with installed wallet extensions, plus broader decline/disconnect/slow-prover recovery coverage.
- Preprod deployment and independently hosted production verifier applications.
- Production authentication, shared transactional storage, monitoring, operations and independent security review.
- An external issuer/user pilot, adoption evidence, finished pitch deck/demo video and final submission/rules confirmation.
- A published npm SDK.

The issuer still knows sample bearer secrets; the workbench server knows its sample witnesses; the local prover sees witnesses; and wallet/timing/batch metadata can correlate activity. No strong unlinkability, meaningful two-leaf anonymity, issuer blindness, login/identity guarantee or retroactive revocation of another application's tokens is claimed.

## Implementation milestones

| Commit | Contribution |
|---|---|
| `11f44d6` | Baseline audit and preservation plan |
| `f354b43` | Bounded V2 qualification lifecycle and contextual verifier SDK |
| `1c2fcf0` | Workbench, reference integrations and validation documentation |
| `d304ed2` | Submission-guide filename normalization |
| `29995c5` | Complete website/workspace visual rebuild |
| `7b0c525` | Real proof artifacts and local Midnight lifecycle validation |
| `0cad436` | Persistent dark mode, Space Grotesk and feature/testing guide |
| `6ed21fe` | Real V2 browser proofs and confirmed chain-backed SDK verification |

The current deliverable is a tested, proof-backed local V2 product prototype with explicit trust boundaries and reproducible evidence. It is not yet a production credential platform or a completed external pilot/submission.
