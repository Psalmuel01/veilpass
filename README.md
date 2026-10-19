# VeilPass

**Prove what qualifies you. Reveal nothing else.**

VeilPass explores reusable developer qualifications: a training issuer commits a credential, and a holder demonstrates application-specific eligibility without handing each application a full personal record. Midnight provides private witnesses and ledger-enforced proof constraints.

## What actually works

- **Existing proof-backed path (`/`):** approved university batch, private graduation predicate, scoped replay protection, encrypted browser vault, wallet/provider integration and historical local Midnight network evidence.
- **New V2 lifecycle:** separate compiled Compact contract with two developer-qualification policies, pinned issuer/admin/audience/domain, ledger-time validity, irreversible revocation/deactivation and one-time request state.
- **Verifier SDK:** strongly typed challenges, contextual binding, expiry/current-status checks, atomic durable replay consumption and explicit execution modes. Default mode refuses generated-execution results.
- **Product/reference surfaces:** local lifecycle workbench, hackathon/community reference pages, developer portal and a two-origin HTTP integration harness. These use generated Compact execution and the SDK; they do not generate V2 ZK proofs.

**Not complete:** official signed credentials, holder-owned key binding, scalable authenticated issuance/issuer registry, V2 finalized-chain adapter, successful V2 network/Preprod lifecycle, production wallet wiring for V2, external pilot and finished submission media. This is a tested protocol extension, not a production credential platform. Workbench server knows the sample witnesses.

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

Open [V2 lifecycle](http://127.0.0.1:3000/lifecycle), [developer portal](http://127.0.0.1:3000/developers), [hackathon sample](http://127.0.0.1:3000/hackathon), or [community sample](http://127.0.0.1:3000/community). Workbench writes require opt-in, same-origin loopback access and an isolated sample session. State expires after one hour/restart. No public hosted V2 demo is deployed.

The [original wallet demo](http://127.0.0.1:3000/) is preserved. Its setup/real local-chain instructions are in [legacy README](docs/LEGACY_README.md); its historical evidence is [local-e2e.json](docs/evidence/local-e2e.json). Old evidence does not validate V2 or a currently live deployment.

## Reproduce verification

```sh
npm test                      # real generated Compact constraints + SDK/vault security tests
npm run demo:verifiers        # two HTTP origins, sample credential reuse/revocation; generated execution
npm run benchmark:lifecycle   # generated execution + SDK filesystem timings, no proof benchmark
npm run test:v2:ui            # Chrome, with opt-in dev server running on :3000
npm run lifecycle:compile     # generate real proving assets
npm run test:lifecycle:e2e    # Docker local network: actual deploy, prove, revoke
```

Generated JavaScript execution is **not a ZK proof**. See [validation results](docs/VALIDATION.md) for what was run successfully and exact blockers. Network evidence is written only after a successful full run; no V2 contract address or transaction has been fabricated.

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
