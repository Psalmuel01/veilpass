# Changelog

## Signed issuance and holder ownership foundation — 20 October 2026

- Add an isolated Node 24 integration using official credential-compact/model 0.3.0, Compact 0.31.1/runtime 0.16.0 and official DID key helpers.
- Add issuer-approved, one-use enrollment, issuer-signed qualification bodies, holder-key binding and application-bound holder signatures.
- Add owner-only encrypted holder backup files, lock/restore, local current-status revocation/deactivation checks and a bounded wire codec.
- Validate 27 adversarial/behavior tests and a local issue/present/recover/revoke demo; retain the existing 50-test V2 suite.
- This foundation is not integrated into the V2 proof-backed contract/SDK or public app. No new ZK transaction, public issuance service, durable status registry or lost-all-backups recovery is claimed.

## Live V2 wallet and confirmed verifier — 19 October 2026

- Add `/live` with in-memory credential import, connector-v4 wallet discovery, local proving, wallet balancing/submission, chain confirmation and independent server SDK verification.
- Add an operator-configured Midnight indexer adapter with deployment/root/domain and three circuit-key pins, typed public-transcript request binding and indexed-head freshness.
- Accept the pinned ledger’s actual versioned transaction identifiers while keeping generated sandbox references explicit.
- Add an interactive disposable funded local-wallet demo, real browser/network harness, captured public wire-format fixture, adapter regressions, API origin/body protections and setup documentation.
- Fix wallet network-change recovery messages and long mobile workspace header labels. Keep generated reference applications separate; no installed-wallet or Preprod acceptance is claimed.


## Appearance and feature guide — 19 October 2026

- Add persistent, system-aware light/dark appearance across the website, V2 workspace, reference apps, developer portal and retained wallet, including cross-tab updates and storage-denied handling.
- Self-host Space Grotesk variable typography with its OFL license.
- Add Chrome appearance acceptance and a complete feature inventory, manual walkthrough, reproduction commands and prioritized roadmap.


## UI rebuild and proof-key generation — 19 October 2026

- Generate real proving and verification artifacts for all three V2 circuits with Compact 0.31.1/runtime 0.16.0; record artifact sizes and SHA-256 hashes.
- Rebuild the public site and app UI with an ivory/ink/ultramarine design, shared navigation/branding, responsive workspace, focused verification, receipts, issuer controls and activity.
- Move the existing proof-backed wallet to `/wallet`, retain its provider/vault logic, update its browser harness and verify the original user journey.
- Redesign developer portal and both SDK-driven reference applications; capture desktop/mobile review evidence.
- Resolve stalled Docker pulls with an isolated anonymous test configuration without changing the operator’s Docker settings.
- Pass the real V2 local-network lifecycle: confirmed deployment, two proof-backed policy authorizations, replay rejection, confirmed revocation and fresh post-revocation rejection. Record actual transaction evidence and separate image download/startup phases in the harness.

## V2 preparation — 19 October 2026 (unreleased)

These changes predate the published October 27 Wave 3 start and are not represented as work completed during that wave.

- Preserve existing proof-backed Wave 1 authorization and history.
- Add separate Compact lifecycle contract with constructor-pinned issuer/admin/domain/audiences, batch validity, two qualification predicates, one-time requests, irreversible revocation and issuer deactivation.
- Add strict canonical encodings/witness types and generated-circuit regression tests.
- Add unpublished TypeScript verifier SDK with short-lived contextual challenges, fail-closed execution modes, status freshness and durable atomic challenge consumption.
- Add local-only lifecycle workbench, two SDK-driven reference pages, developer portal, two-origin HTTP harness and a real local-network lifecycle harness.
- Add baseline, architecture, privacy, threats, compatibility, deployment, SDK, pilot, demo, submission and competition documentation.
- Patch dependency advisories (Next 15.5.28, Vitest 5.0.5/Vite 7.3.6, ws 8.22.0, PostCSS 8.5.28 and compatible transitives); final npm audit reports zero known vulnerabilities.
- No official signed-VC integration, live V2 deployment, external pilot, or in-wave eligibility is claimed.

## Existing baseline — through `07a3bc1`

Immutable two-leaf university batch, private graduation threshold, application-scoped nullifier, encrypted browser vault, connector/provider integration, historical real local-network evidence, browser checks, responsive dashboard and documentation. Existing commits are retained; this changelog does not reattribute that work to V2.
