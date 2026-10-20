# VeilPass release acceptance

The hosted frontend/issuer is a Preprod pilot. This checklist records evidence, not a production certification.

| Requested work | Implemented and verified | Remaining acceptance |
| --- | --- | --- |
| Credential journey | Holder-generated keys, holder-bound approval, issuer signatures, role-protected administration, encrypted browser vault/export/import, expiry/revocation. Actual hosted API journey passed with a synthetic credential subsequently revoked. | Fresh installed-wallet/browser journey on the hosted service and issuer organization verification. |
| Real Midnight proofs | V3 checks issuer/holder signatures, qualification and hidden active-status membership, one-time request and current registry state. Prior real local-network browser proof evidence exists. | Actual Preprod deployment and hosted proofs; local policy checks are not chain authorizations. |
| Persistent state | Neon encrypted authority, atomic status/replay/rate budgets, named role accounts, token expiry/rotation/disablement, authority-change audit, encrypted empty-target recovery and storage-key rotation tested against Postgres. | Signing-key rollover with explicit contract/verifier migration, full database disaster recovery, operator approval/provisioning and recovery ownership. |
| Hosted backend | Render Free and Neon deployed, stable issuer pinned, Vercel proxies issuance, Git deployments configured. Hosted signed issuance/revocation passed. | Trusted sufficiently capable prover, constrained Blockfrost gateway and network-schema acceptance, funded Lace deployment transaction. |
| Real conditions | Local constraints test forgery, expiry, revocation, ownership/replay, key substitution, recovery, delayed indexer and retries. HTTP tests exercise named roles and disablement. | Installed Lace rejection/disconnect/network switching/slow proof, hosted fresh-browser recovery, Safari/mobile device acceptance. |
| Polish and review | Existing theme/responsive UI, clear issuer scope, backend readiness separate from liveness, read-only daily smoke workflow, dependency audit, CI and operations runbook. | Full accessibility/device audit, independent security review and remediation. |
| External pilot | Measurement requirements and acceptance boundaries documented in OPERATIONS.md. | A consenting real issuer and two independent applications, measured results and final recorded demo. No external results invented. |

## Critical infrastructure gate

The actual V3 proving trial was OOM-killed at 512 MiB and 2 GiB; Render Free cannot serve this prover. Keep hosted network proofs disabled. No paid upgrade or untrusted public prover has been authorized. A trusted machine with sufficient RAM, a verified eligible free hosting allocation, or sponsored infrastructure is required. Record a successful real proof before choosing capacity. Do not weaken circuits or privacy claims to fit the free plan.

A real Preprod deployment also requires the operator's wallet approval and DUST readiness. Never request a seed phrase. Git pushes do not authorize wallet transactions or replacement issuer identities/contracts.

## Reproduce release checks

Run Node 24, `npm ci`, `npm audit --audit-level=high`, typechecks and both test suites. CI compiles constraints, tests real disposable Postgres, builds the app, runs HTTP role/issuance acceptance and checks the holder UI. `scripts/hosted-readiness.mjs` performs read-only checks against the public issuer. `scripts/hosted-journey.ts <private-env-file> --exercise-issuer` performs one explicitly synthetic issuance and revocation; it is not a load test or a chain proof.

Operator provisioning, offline recovery and storage-key rotation commands are in [OPERATIONS.md](OPERATIONS.md). Only encrypted authority snapshots are backed up by the application utility; retain database-level backups and reconcile all post-snapshot revocations before recovery traffic resumes.
