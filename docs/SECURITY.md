# Security status

Development prototype. Do not issue real personal credentials or production access permissions using the V2 workbench. It runs sample witnesses on the local server and is explicitly labeled generated execution.

See `THREAT_MODEL.md` and `PRIVACY_MODEL.md` for controls and residual risks. `BASELINE_AUDIT.md` records inherited behavior. Run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:v2:ui` and, with Docker, `npm run test:lifecycle:e2e`.

Before release: integrate official signed credentials and holder-owned binding; independently review the pinned Midnight transaction adapter and compiler-specific transcript parser; rerun full proof-backed lifecycle and transaction inspection; pin and verify Preprod deployment; add scalable authenticated issuance, administrative key lifecycle and transactional shared challenge state; review dependencies; obtain independent protocol/security review.

The initial 19 October install reported 9 advisories (2 moderate, 5 high, 2 critical); the original report is retained in `evidence/npm-audit-baseline.json`. Applied Next 15.5.28, Vitest 5.0.5, Vite 7.3.6, ws 8.22.0, a PostCSS 8.5.28 override and compatible transitive fixes while retaining every Midnight direct pin. The final `evidence/npm-audit.json` reports zero known advisories. This is registry advisory status, not a security audit or a guarantee against unknown vulnerabilities. All 42 regression tests and strict typecheck pass on the updated tree.

Private material belongs in ignored `.private` paths and must never appear in screenshots, telemetry or issue reports. Workbench errors allowlist constraint messages and SDK error codes. Never submit seed phrases, wallet keys, credentials or raw witness traces in a report. There is no project security contact configured yet; operator must provide a private reporting channel before production release.
