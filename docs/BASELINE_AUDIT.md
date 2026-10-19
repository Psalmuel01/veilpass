# Baseline audit — 19 October 2026

Audited revision: `07a3bc1`. Working tree was clean. Existing history preserved.

## Architecture and inventory

Next.js 15.5.25 App Router, React 19.1.1, TypeScript 5.9.3 strict, Tailwind 4.1.18, Lucide icons. One client page with overview, credential, verification and privacy tabs; two Node API routes (`/api/config`, `/api/credential`). No database, SDK package, issuer dashboard, verifier dashboard or external application.

Compact 0.31.1 compiler is installed in `.toolchain`; language 0.23, runtime 0.16.0, Midnight.js 4.1.1, Compact JS 2.5.1, connector 4.0.1 and ledger 8.1.0 are pinned. Generated contract code, keys and ZKIR are present but ignored. `veilpass.compact` has one fixed two-leaf issuer batch, one immutable issuer, one application scope, a fixed graduation-year predicate and a nullifier set. Credential authenticity is **root membership, not issuer signatures**.

`packages/credential` defines fixed-length UTF-8/hex encodings, generated persistent hashes and witnesses. Secret, student identifier, degree, year and subject are private. `memory-provider` scopes witness state by contract. The browser vault uses AES-GCM-256 and PBKDF2-SHA256/310,000 iterations; only ciphertext persists in localStorage. Witness plaintext exists in browser memory and the loopback prover. `midnight.ts` implements actual wallet discovery, network validation, indexer checks, proving, balancing, submission and confirmed receipts.

Scripts cover compiler installation with checksums, key generation, sample issuer setup, Docker local chain, funded development wallet, real proving and browser connector tests. Docker images and local endpoints are explicit in compose files. No CI pipeline or production hosting configuration was found. Existing local evidence and screenshots are historical artifacts, not a current deployment.

## Working and reusable

The contract, generated bindings, provider wiring, encrypted vault, private-state isolation, redacted SDK errors, responsive UI, unit/security tests and real local-network harness are worth retaining. The recorded local evidence reports proof-backed authorization, invalid-case rejection, replay rejection and transaction byte scans. These were not yet rerun during this audit.

## Partial or missing

Sample delivery is not authenticated issuance: anyone on the same origin can retrieve either shared sample. The secret is issuer-known bearer material. No signatures, holder-owned key binding, per-user issuance, expiry, revocation, issuer administration, challenge binding, policy configuration, cross-application SDK or external pilot exists. No Preprod address is configured. UI success reflects confirmed transactions in the existing path, not a simulated button result.

## Risks and refactors

- Two known credentials provide no meaningful anonymity set; issuer knows their secrets.
- A scoped nullifier links all actions within its scope. Wallet/timing metadata remains observable.
- Same-origin checking alone is not authentication or rate limiting. Do not expose sample issuance as a production service.
- Unlocked browser data is accessible to XSS/extensions. Passphrases are susceptible to offline guessing. No recovery exists.
- Legacy credential parsing checks only some fields; import needs strict structural validation.
- No trusted expiry, freshness or current-status policy. Existing authorization remains forever.
- No root/admin mutation path; deployer trust must be pinned by each verifier.
- Main UI is monolithic; add separate routes for new workflows without breaking the proven legacy route.

## Baseline execution

Host default Node is 20.19.0; required Node 22.22.0 exists under `~/.nvm/versions/node/v22.22.0`. Dependencies were absent. Initial `npm ci` failed under restricted DNS (`ENOTFOUND registry.npmjs.org`). Baseline `npm test` fails (`vitest` missing), typecheck fails on missing dependency types, build fails (`next` missing). No lint script exists. Compiler reports 0.31.1. Docker reports daemon unavailable at the configured Unix socket; real-network tests cannot run until Docker starts. Installation is being retried with network authorization; later results are recorded separately.

## Implementation order

1. Preserve legacy proof-backed workflow and explicitly label evidence.
2. Add a separately versioned Compact lifecycle contract: fixed trusted batch, monotonic revocation, issuer deactivation, trusted time, two policy/audience domains and one-shot challenges.
3. Add strict encoding/witness types, generated-execution security tests and a fail-closed verifier SDK with injected confirmed-chain adapter.
4. Add two reference verifier routes, lifecycle workbench and SDK portal, with execution modes displayed honestly.
5. Compile, test, typecheck, build, run browser checks; generate keys where available.
6. Rerun real network lifecycle when Docker is available; deploy to Preprod only with a funded operator wallet. Record gaps and pilot/submission prerequisites without invented evidence.

After authorized installation under Node 22.22.0, the unchanged legacy baseline passed all 18 tests, strict typecheck and production build. Later V2/security-patch verification is recorded in `VALIDATION.md`; those results are separate from this baseline.
