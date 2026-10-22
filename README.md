# VeilPass

**Prove what qualifies you. Reveal nothing else.**

VeilPass explores reusable developer qualifications: a training issuer commits a credential, and a holder demonstrates application-specific eligibility without handing each application a full personal record. Midnight provides private witnesses and ledger-enforced proof constraints.

For a complete feature inventory, browser walkthrough, test commands and prioritized roadmap, see [feature status and testing guide](docs/FEATURE_STATUS.md).

## Current Preprod acceptance — 22 October 2026

The signed V3 lifecycle has now passed on real Midnight Preprod: published active status, two confirmed eligibility authorizations, independent verification, durable replay rejection, confirmed revocation and a fresh revoked-credential circuit rejection after encrypted backup recovery. See the [recorded acceptance evidence](docs/evidence/preprod-authorization.json) and [final deployment report](docs/FINAL_DEPLOYMENT_REPORT.md). This was a dedicated terminal operator test using a synthetic credential. Installed-wallet and hosted-browser proof acceptance remain pending; public proof activation stays disabled.

## What actually works

- **Existing proof-backed path (`/wallet`):** approved university batch, private graduation predicate, scoped replay protection, encrypted browser vault, wallet/provider integration and historical local Midnight network evidence.
- **New V2 lifecycle:** real local-network deployment and proof-backed two-policy authorization/revocation are now recorded in [V2 network evidence](docs/evidence/lifecycle-network.json). The separate Compact contract enforces two developer-qualification policies, pinned issuer/admin/audience/domain, ledger-time validity, irreversible revocation/deactivation and one-time request state.
- **Live V2 browser (`/live`):** local credential import, connector wallet, real proving/submission/confirmation and independent chain-backed SDK verification. Run `npm run demo:live` for a disposable funded local-wallet demo; see [live setup](docs/LIVE_V2.md).
- **Verifier SDK:** strongly typed challenges, contextual binding, expiry/current-status checks, atomic durable replay consumption and explicit execution modes. Default mode refuses generated-execution results.
- **Product/reference surfaces:** local lifecycle workbench, hackathon/community reference pages, developer portal and a two-origin HTTP integration harness. These use generated Compact execution and the SDK; they do not generate V2 ZK proofs.

**Remaining production gates:** hosted Preprod proof acceptance, institutional issuer onboarding, installed-wallet acceptance, operational key rotation/reissuance, independent review and external pilot. Hosted signed issuance already uses the Render API and durable Neon storage. The new signed V3 flow is separate from V2. This is a tested protocol extension, not a production credential platform. Workbench server knows the sample witnesses.

The interface now includes persistent system-aware dark mode and self-hosted Space Grotesk typography. It has been rebuilt with a dedicated public website, an ivory/ink/ultramarine workspace, responsive navigation, focused verification, and a restyled wallet. See [UI rebuild notes](docs/UI_REDESIGN.md).

## Signed issuance, holder custody and V3

The signed flow now includes `/holder` and `/issuer`: device-generated holder keys, operator-authenticated holder-bound enrollment, real issuer/holder signatures, encrypted browser storage and recovery, durable encrypted authority state (Neon for the hosted service; SQLite for local development), safe issuance retries and irreversible revocation. See the [signed workflow guide](docs/SIGNED_ISSUANCE.md).

A separate V3 contract and verifier use the official credential constraints, private active-status membership, pinned circuit/issuer keys, ledger-time request windows and durable replay protection. Actual local-network deployment, both proof-backed policies, independent confirmed-transaction verification and revocation passed; see [V3 network evidence](docs/evidence/signed-network.json). V2 remains a separate flow.

The app now uses **Node 24.22.0** and one npm workspace lockfile so all Midnight components share one WASM runtime. The browser now passes the [complete signed proof lifecycle](docs/evidence/signed-browser-network.json) using a disposable connector wallet; installed-wallet and hosted-browser Preprod acceptance remain required. The hosted credential journey is available; institutional issuer onboarding, operational key rotation, independent review and the external pilot remain incomplete. Start with [Preprod account and wallet setup](docs/PREPROD_SETUP.md).

## Hosted deployment and confirmation

The public website is [useveilpass.vercel.app](https://useveilpass.vercel.app/). Vercel serves the interface, Render runs the backend, and Neon stores durable encrypted issuer state. GitHub pushes deploy the application services; a Midnight contract requires its own confirmed chain transaction.

The [terminal operator guide](docs/PREPROD_TERMINAL.md) explains the dedicated Preprod wallet, encrypted recovery, DUST registration and deployment. The V3 contract is confirmed on Preprod at `5120e2bc49267ad91653edb9806a010da0bb0428d78acd9dbf0e994a058cd24a`. See [funding and deployment evidence](docs/evidence/preprod-terminal.json) and the successful [independent deployed-state check](docs/evidence/preprod-release.json). Hosted proof acceptance remains pending.

To check completion without starting another wallet process:

```sh
# Written only after deployContract returns a confirmed deployment:
cat .private/preprod-terminal/deployment.json
# Independently check deployed contract state and pinned verifier keys:
npm run preprod:release -- .private/hosted-preprod/render.env .private/preprod-terminal/deployment-config.json
```

A missing `deployment.json` means the terminal tool has not recorded confirmation. An attempt file or transaction reference alone is insufficient. The independent release check writes `docs/evidence/preprod-release.json` only on success. Do not start a second `bootstrap`, `register`, `deploy` or wallet `status` process while the existing operator run is active. Keep all `.private` contents out of Git and chat.

Hosted builds now install the exact public proving assets from a hash-pinned GitHub release. A restricted Render HTTP/WebSocket gateway keeps Blockfrost authentication server-side; its read-only checks are recorded in [gateway evidence](docs/evidence/preprod-gateway.json). Terminal authorization acceptance has passed; public browser activation remains a separate gate.

Contract confirmation is one milestone. Hosted-browser proofs, installed-wallet tests and external review remain separate release gates; the hosted readiness endpoint deliberately keeps `productionReady: false` until those gates are addressed.

## Run it

Use Node **24.22.0** (installed through nvm), npm and Compact 0.31.1. Docker is needed for actual network proofs.

```sh
nvm install                     # first setup only
nvm use
npm ci
npm run toolchain:install     # skip if pinned compiler already installed
npm run contract:check
npm run lifecycle:check
npm run signed:check
npm test
npm run typecheck
npm run build
VEILPASS_WORKBENCH=1 npm run dev
```

Open [V2 lifecycle](http://127.0.0.1:3000/lifecycle), [developer portal](http://127.0.0.1:3000/developers), [hackathon sample](http://127.0.0.1:3000/hackathon), or [community sample](http://127.0.0.1:3000/community). Workbench writes require opt-in, same-origin loopback access and an isolated sample session. State expires after one hour/restart. The [public product preview](https://useveilpass.vercel.app) is hosted on Vercel. Its local-only sample sessions and proof-backed flow require the local setup; it is not a public Midnight deployment.

The [original wallet demo](http://127.0.0.1:3000/wallet) is preserved. Its setup/real local-chain instructions are in [legacy README](docs/LEGACY_README.md); its historical evidence is [local-e2e.json](docs/evidence/local-e2e.json). Old evidence does not validate V2 or a currently live deployment.

## Reproduce verification

```sh
npm test                      # real generated Compact constraints + SDK/vault security tests
npm run demo:verifiers        # two HTTP origins, sample credential reuse/revocation; generated execution
npm run benchmark:lifecycle   # generated execution + SDK filesystem timings, no proof benchmark
npm run test:v2:ui            # Chrome, with opt-in dev server running on :3000
npm run lifecycle:compile     # generate real proving assets
npm run test:lifecycle:e2e    # Docker local network: actual deploy, prove, revoke
```

The V2 proving and verification keys have now been generated successfully for all three circuits; sizes and SHA-256 hashes are in [artifact evidence](docs/evidence/lifecycle-artifacts.json). Key generation is distinct from generating a transaction proof or confirming a deployment.

Generated JavaScript execution is **not a ZK proof**. See [validation results](docs/VALIDATION.md) for what was run successfully and exact blockers. The V2 local-network run passed; its actual contract and transaction references are recorded in the evidence file. This was a disposable local chain, not Preprod. Network evidence is written only after a successful full run.

## Inspect the implementation

- [V2 Compact contract](contracts/lifecycle/lifecycle.compact), [original contract](contracts/veilpass/veilpass.compact)
- [SDK implementation](packages/sdk/index.ts), [integration guide](docs/SDK_GUIDE.md)
- [Baseline audit](docs/BASELINE_AUDIT.md), [architecture](docs/ARCHITECTURE.md)
- [Privacy boundary](docs/PRIVACY_MODEL.md), [threat model](docs/THREAT_MODEL.md), [security](docs/SECURITY.md)
- [Compatibility investigation](docs/MIDNIGHT_COMPATIBILITY.md), [deployment](docs/DEPLOYMENT.md)
- [Competition analysis](docs/COMPETITIVE_ANALYSIS.md), [pilot status](docs/PILOT_RESULTS.md)
- [Demo script](docs/DEMO_SCRIPT.md), [submission preparation](docs/SUBMISSION.md), [changelog](CHANGELOG.md)

## Privacy and trust

V2 authenticates a bounded two-leaf batch through an issuer-pinned Merkle root, **not a VC signature**. Its holder secret is bearer material known to the sample issuer. Public request keys bind network, audience, policy, nonce and deadline; they contain no holder-derived identifier. Batch, status, wallet and timing metadata can still correlate activity, and two known samples provide no meaningful anonymity set.

Legacy private credentials persist only as PBKDF2/AES-GCM ciphertext; an unlocked browser or local prover can read witnesses. Workbench uses server-known sample data and must never receive real credentials. Eligibility is not login, identity verification or a revocable application access token.

## Buildathon and licensing

This work is dated **19 October 2026**, before the published October 27 Wave 3 build start. It is preparation; no in-wave eligibility, award or external adoption is claimed. Preserve the changelog and confirm the actual official deadline/rules with organizers.

New V2 additions are Apache-2.0; see [LICENSE](LICENSE) and [NOTICE](NOTICE). Existing code/dependency rights retain their applicable terms. The SDK is private source code, not a published npm package.
