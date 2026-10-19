# Changelog

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
