# Submission preparation — not submitted

VeilPass: **Prove what qualifies you. Reveal nothing else.** Developer/professional eligibility using Midnight private constraints, with explicit lifecycle and verifier-integration boundaries.

## Rules verification

Reviewed the [official Midnight Buildathon page](https://midnight.network/hackathon/buildathon) and [AKINDO program](https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG). Published dates put Wave 3 on October 27–November 16, 2026. This October 19 work predates that period: classify it as preparation, never eligible in-wave development. AKINDO's dynamic timeline showed differing dates; confirm actual deadline/timezone with organizers. Binding rules PDF and full linked judging rubric were not obtainable from the fetched page, so their complete review remains outstanding.

The public summary requires material Midnight progress during the applicable wave, public Apache-2.0 Midnight code, repository/README, deck, demo/video, change explanation and `midnightntwrk` repository topic. Entry must be submitted personally by a registered participant. No entry or external communication was sent.

## Evidence package

- Baseline: `docs/BASELINE_AUDIT.md`, revision `07a3bc1`.
- New code: lifecycle contract, strict witness model, verifier SDK, reference applications and security tests.
- Validation: `docs/VALIDATION.md`.
- Privacy and security: `PRIVACY_MODEL.md`, `THREAT_MODEL.md`, `SECURITY.md`.
- Reproduction: `DEPLOYMENT.md`, `SDK_GUIDE.md`, `DEMO_SCRIPT.md`.
- Historical legacy network evidence: `docs/evidence/local-e2e.json` only; not V2/Preprod proof.
- Pilot: `PILOT_RESULTS.md`; no external participants.

## Current release/submission gaps — 22 October 2026

Signed issuance, holder keys, encrypted recovery, persistent hosted state and the real V3 Preprod lifecycle are implemented. See [final deployment report](FINAL_DEPLOYMENT_REPORT.md) and [final demo checklist](FINAL_DEMO_CHECKLIST.md). The terminal test confirmed two policies, replay protection and revocation. Installed-wallet and hosted-browser proof acceptance, persistent prover hosting, independent review, issuer governance and an external pilot remain open. The updated judges' video is being prepared; do not call it complete before export and review.

The earlier rules review above is historical. Reconfirm the current eligible wave, deadline, rubric, participant registration, repository topic and licensing before submission. No entry has been submitted.

## Licensing

New V2 code is offered under Apache-2.0 as requested; see `LICENSE` and `NOTICE`. No third-party project code was copied into implementation. Existing dependency and generated-artifact notices retain their own terms. Prior repository license provenance must be confirmed by the owner before relicensing pre-existing code; the notice explicitly scopes this addition to new work.

Follow-up milestone: full V2 proof keys are generated and hashed in `evidence/lifecycle-artifacts.json`. The public website and application UI have been rebuilt; see `UI_REDESIGN.md`. A real disposable local-network lifecycle also passed, with actual references in `evidence/lifecycle-network.json`. These improvements remain dated October 19 and do not establish in-wave eligibility or public Preprod deployment.
