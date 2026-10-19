# VeilPass

**Prove what qualifies you. Reveal nothing else.**

VeilPass explores reusable developer qualifications: a training issuer commits a credential, and a holder demonstrates application-specific eligibility without handing each application a full personal record. Midnight provides private witnesses and ledger-enforced proof constraints.

For a complete feature inventory, browser walkthrough, test commands and prioritized roadmap, see [feature status and testing guide](docs/FEATURE_STATUS.md).

## What actually works

- **Existing proof-backed path (`/wallet`):** approved university batch, private graduation predicate, scoped replay protection, encrypted browser vault, wallet/provider integration and historical local Midnight network evidence.
- **New V2 lifecycle:** real local-network deployment and proof-backed two-policy authorization/revocation are now recorded in [V2 network evidence](docs/evidence/lifecycle-network.json). The separate Compact contract enforces two developer-qualification policies, pinned issuer/admin/audience/domain, ledger-time validity, irreversible revocation/deactivation and one-time request state.
- **Live V2 browser (`/live`):** local credential import, connector wallet, real proving/submission/confirmation and independent chain-backed SDK verification. Run `npm run demo:live` for a disposable funded local-wallet demo; see [live setup](docs/LIVE_V2.md).
- **Verifier SDK:** strongly typed challenges, contextual binding, expiry/current-status checks, atomic durable replay consumption and explicit execution modes. Default mode refuses generated-execution results.
- **Product/reference surfaces:** local lifecycle workbench, hackathon/community reference pages, developer portal and a two-origin HTTP integration harness. These use generated Compact execution and the SDK; they do not generate V2 ZK proofs.

**Not complete in the deployed/V2 proof flow:** official signed credentials, holder-owned key binding, scalable authenticated issuance/issuer registry, Preprod deployment, installed-wallet acceptance for V2, external pilot and a finished submission package. This is a tested protocol extension, not a production credential platform. Workbench server knows the sample witnesses.

The interface now includes persistent system-aware dark mode and self-hosted Space Grotesk typography. It has been rebuilt with a dedicated public website, an ivory/ink/ultramarine workspace, responsive navigation, focused verification, and a restyled wallet. See [UI rebuild notes](docs/UI_REDESIGN.md).

## Signed issuance and holder ownership — local milestone

An isolated [Node 24 integration](integrations/issuance/README.md) now issues real issuer-signed qualifications bound to holder-generated keys, verifies contextual holder signatures, and supports encrypted backup/recovery and local revocation checks. It uses the official Midnight credential libraries and passes 27 security/behavior tests; see [validation evidence](docs/evidence/signed-issuance-local.json).

This is generated Compact signature/constraint execution, not a new ZK transaction flow. It is not wired into `/live`, the V2 contract/SDK, or the hosted app. The new issuer/status/request stores are ephemeral local objects; authenticated public issuance, durable authority custody and new proof integration remain next. Root Node 22 workflows are unchanged.

## Run it

Use Node **22.22.0** (installed through nvm), npm and Compact 0.31.1. Docker is needed for actual network proofs.

```sh
nvm use
npm ci
npm run toolchain:install     # skip if pinned compiler already installed
npm run contract:check
npm run lifecycle:check
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
