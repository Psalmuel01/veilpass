# Validation — 19 October 2026

Environment: macOS arm64, Apple M2, Node 22.22.0. Compact 0.31.1, runtime 0.16.0; Midnight direct pins unchanged. Next 15.5.28, Vitest 5.0.5 / supported Vite 7.3.6, PostCSS override 8.5.28, ws 8.22.0. No separate lint script exists; production build includes Next's lint/type validation phase.

| Check | Actual result | Boundary |
|---|---|---|
| Original baseline tests | 18 passed after dependency installation | Existing generated-circuit/vault checks |
| `npm run contract:check` | Passed | Existing Compact generated execution, no key generation |
| `npm run lifecycle:check` | Passed | Three V2 circuits compile with pinned compiler; no proof generated |
| `npm test` after security patches | 42 passed across 4 files | 12 legacy contract, 6 vault/state/error, 18 V2 constraints, 6 SDK integration tests |
| `npm run typecheck` | Passed | Strict root and web TypeScript |
| Production build | Passed with `VEILPASS_BUILD_DIR=.next-validation npm run build` | All pages/API routes; lifecycle first-load JS approximately 112 kB |
| `npm run demo:verifiers` | Passed | Actual HTTP listeners on 4101/4102; generated Compact + SDK, not proofs |
| Production browser acceptance | Passed | Headless Chrome against isolated production build on 3003 |
| Desktop / mobile screenshots | Captured and visually inspected | `docs/screenshots/v2/`, mobile viewport 390×844; no horizontal overflow |
| `npm run benchmark:lifecycle` | Passed, 20 measurements | Generated evaluation and durable SDK verification only; JSON evidence |
| Final npm audit | 0 known advisories | `docs/evidence/npm-audit.json`; initial 9-advisory report retained separately |
| `git diff --check` | Passed | Whitespace validation |
| V2 proof-key generation | Passed on approved follow-up | Six real compiler-generated prover/verifier artifacts; sizes/hashes in `evidence/lifecycle-artifacts.json`; no transaction proof implied |
| V2 local-network E2E | Passed | Real generated proofs, confirmed deploy, two authorizations, replay rejection, confirmed revocation and fresh rejection under both policies; evidence/lifecycle-network.json |
| V2 Preprod deployment | Not performed | No funded operator wallet or completed finalized-chain adapter |
| External pilot | Not performed | No external participants or adoption evidence |

## Security scenarios exercised

V2 generated execution covers authentic qualification under both policies, tampering of issuer/program/secret/level/completion/expiry, wrong policy/audience/domain binding, insufficient professional level, future/expired credential, expired challenge, unauthorized revoke/deactivate, irreversible revocation, unaffected second record, issuer deactivation, one-time requests, field encoding and private-output boundaries.

SDK integration uses the actual generated contract adapter plus durable filesystem stores. It covers two applications, pre-revocation receipt invalidation, fresh rejection after revocation, challenge substitution, wrong verifier, malformed version, unknown authorization, eight concurrent consumption attempts (one success), reopened-store replay rejection, stale state, expiry and generated-result rejection in default confirmed mode.

Browser acceptance covers initialization, both policy happy paths, insufficient level, SDK replay failure, mobile overflow, issuer revocation and fresh failure on both reference pages, plus developer portal loading. No wallet-disconnection/slow-proof/Preprod browser coverage is claimed for V2. Legacy unit tests remain passing; historical network evidence is not a fresh rerun.

## Failures found and fixed

Next could not resolve `.js` imports for new TypeScript source files; switched source imports to bundler-compatible paths. Development hot reload discarded sample ledger state; session map now survives module reload but not process restart. Concurrent rebuilds interrupted development acceptance with generated-file/HMR errors; final acceptance used the isolated production server. Visual inspection found a checkbox affected by existing global input width; added explicit dimensions. Security patching introduced an npm/Vite 8 optional-native binding installation failure; pinned the supported Vite 7 backend, then reran the complete suite. No passing results from the failed runs are substituted for the final successful run.

## Reproduce the isolated browser run

```sh
VEILPASS_BUILD_DIR=.next-validation npm run build
VEILPASS_WORKBENCH=1 VEILPASS_BUILD_DIR=.next-validation npm run start -- --port 3003
# In another terminal:
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 npm run test:v2:ui
```

All runs explicitly distinguish generated circuit evaluation, SDK verification, actual proofs, submission and confirmation. Actual V2 local transaction IDs are recorded only from the successful network run. No pilot participants or proving benchmark numbers have been fabricated.

## Approved follow-up: interface rebuild and key generation

The operator authorized continued proof-key generation and requested a complete UI overhaul. All three V2 circuits now have generated proving/verification artifacts. The public site was rebuilt at `/`, the original provider/vault workflow moved to `/wallet`, and the lifecycle workspace, developer portal and two reference application pages were redesigned. The production build includes all nine routes and passes type validation. The existing 42 tests remain passing.

Chrome production checks passed for the complete V2 lifecycle (including negative policy, replay, and revocation in both apps), the redesigned website/mobile navigation and reference-app happy paths, and the retained encrypted-vault workflow. New screenshot evidence is in `docs/screenshots/redesign`. The visual pass enlarged application typography, strengthened secondary text contrast, removed an invisible duplicate policy select, and added focus management/Escape dismissal to the mobile workspace menu. Full-page screenshot capture scrolls to the top and waits for a rendered frame to avoid capture stitching during viewport changes.

The redesigned homepage first-load JS is approximately 109 kB, lifecycle approximately 116 kB, and retained wallet approximately 113 kB as emitted by the production build. These bundle sizes are not Lighthouse performance scores. `UI_REDESIGN.md` describes the design and interaction changes.

### Real-network result

`npm run test:lifecycle:e2e` passed under Node 22.22.0 with Docker Desktop 27.5.1 and the isolated configuration described in `DEPLOYMENT.md`. Public images were proof-server 8.1.0, node 1.0.2 and indexer-standalone 4.3.3-hotfix. The first combined image-download/startup attempt hit a 600-second timeout before deployment; independent image pulls completed, and the retried run passed with images cached. The harness now separates bounded image preparation from runtime readiness, making that distinction reproducible.

The successful run deployed the actual V2 contract, generated and confirmed authorizations for both pinned audience/policy pairs with the same credential, rejected replay, confirmed issuer revocation, and rejected fresh authorization under both policies. `evidence/lifecycle-network.json` contains actual references. The funded test wallet and local node/indexer/prover are real, not mocked. The chain was disposed after the run and cannot be inspected through a public Preprod explorer.

This validates the contract's local network lifecycle. The browser sandbox still deliberately runs generated execution; it does not silently become a live proof-backed V2 frontend. Signed-credential integration, a finalized V2 verifier adapter, Preprod deployment and external pilot remain outstanding.
