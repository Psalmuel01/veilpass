# VeilPass

**Prove what matters. Keep the rest private.**

VeilPass is a Midnight-native prototype for privacy-preserving credential authorization. A holder proves possession of an issuer-approved university credential with graduation year ≥ 2020. Compact enforces authenticity and eligibility; the public contract records an application-scoped nullifier instead of credential attributes.

**Implemented and tested:** Compact compilation and key generation, real local Midnight deployment and proof-backed authorization, rejection of ineligible credentials and replay, encrypted browser storage, wallet connector integration, frontend, and automated tests. Local network transaction evidence is in [`docs/evidence/local-e2e.json`](docs/evidence/local-e2e.json). **There is no public Preprod deployment supplied.** Local test environments are ephemeral.

![VeilPass overview](docs/screenshots/overview.png)

## Problem and solution

Applications often collect full credentials to answer a narrow eligibility question. VeilPass evaluates that question privately and publishes only the authorization evidence required by the application.

## Why Midnight

The Compact `authorize` circuit consumes private witnesses, verifies a salted credential commitment against an issuer batch root, checks the fixed graduation policy, and inserts a nullifier into Midnight public state. The frontend uses Midnight.js to construct, prove, balance, submit and observe actual transactions. Running the generated JavaScript checks is useful for tests but is **not** represented as generating a ZK proof.

## Demo

Two issuer-generated samples are available: 2024 (eligible) and 2018 (ineligible). They use independently generated random secrets and identifiers. The batch is fixed at deployment. The issuer endpoint distributes these samples; it is not a production university identity service.

See [`docs/demo.md`](docs/demo.md) for the 2–4 minute walkthrough and [`docs/acceptance.md`](docs/acceptance.md) for completion evidence and limitations.

## Architecture

```text
Demo issuer (.private/issuer-batch.json)
    ├─ private sample credential + membership path → holder encrypted vault
    └─ public root + approved issuer + app scope → Compact constructor

Holder vault → private witnesses → local proof server → wallet → Midnight
                                                             └─ public nullifier
```

[`docs/architecture.md`](docs/architecture.md) describes the actual components. No arbitrary policy engine, issuer registry, or revocation service is implemented.

## Privacy model

| Information | Private / public |
|---|---|
| Student ID and subject | Private: issuer, holder, trusted local prover |
| Exact graduation year and degree | Private: issuer, holder, trusted local prover |
| Credential contents and secret | Private: issuer, holder, trusted local prover |
| Eligibility result | Public / verifier-visible |
| Policy and approved issuer | Public |
| Batch root and application scope | Public |
| Authorization nullifier | Public |
| Transaction metadata | Public as required by Midnight |

The local prover receives witness material. “Local” is a trust boundary, not a cryptographic promise against a malicious prover. The issuer knows the demo samples. Browser code can see unlocked credentials. See [`docs/privacy-model.md`](docs/privacy-model.md) for traffic boundaries, metadata leakage and test limitations.

## Credential lifecycle

`issuer:setup` generates two random bearer credentials and commits every field, including a 256-bit secret. It refuses to overwrite an existing batch. The issuer initializes the contract with the batch root. The browser receives one sample through a no-store same-origin POST and encrypts it with AES-256-GCM using a locally derived PBKDF2 key. The vault passphrase is never sent to the server. Locking removes the active credential from React state; refreshing requires unlocking again.

## Verification lifecycle

1. Connect a Midnight connector v4-compatible wallet on the configured network.
2. Load and unlock a sample credential.
3. Confirm the on-chain root and application scope match the credential.
4. Execute Compact witnesses and constraints, then request an actual local proof.
5. Ask the wallet to balance and sign; submit the transaction.
6. Wait for indexer confirmation **and check the authorization in public contract state**.

UI stages follow provider calls, not timers. Errors do not become success. SDK exception payloads are not displayed or logged by the application.

## Contract

Source: [`contracts/veilpass/veilpass.compact`](contracts/veilpass/veilpass.compact).

- Immutable application-level issuer batch root, approved issuer, and application scope.
- Private two-leaf Merkle membership verification. Individual commitments/path direction are not disclosed.
- All credential fields bound to one persistent hash.
- `graduationYear >= 2020`, schema version and issuer equality constrained in circuit.
- Domain-separated application nullifier; duplicate authorizations rejected.
- Public state contains only root, issuer, application ID and authorization set.

The deployer's maintenance authority is trusted; application code has no root-update circuit. A verifier must pin the correct contract address. An arbitrary holder-created contract is not a trusted issuer deployment.

## Running locally

Requirements: Node **22.22.0+**, npm, `unzip`; Docker Desktop for actual proofs/network tests; Chrome for browser checks. macOS and Linux compiler downloads are supported. Windows users should use WSL.

From the repository root:

```bash
nvm use
npm ci
npm run toolchain:install
npm run contract:compile
npm run issuer:setup
npm test
npm run dev
```

Open http://127.0.0.1:3000. Credential and vault flows work immediately. Network verification requires either the full local E2E command below or your configured wallet/deployment.

Compiler download checks a pinned SHA-256 digest. The first compile/prover start may download public parameters. `.toolchain`, generated proof assets and `.private` are ignored by Git. Never commit the issuer batch or wallet material.

### Pinned baseline

| Component | Version |
|---|---|
| Compact compiler | 0.31.1 |
| Compact language | 0.23 |
| Compact runtime | 0.16.0 |
| Compact JS | 2.5.1 |
| Midnight.js | 4.1.1 |
| Ledger v8 | 8.1.0 (single npm override) |
| DApp connector | 4.0.1 |
| Proof server | 8.1.0 |
| Local node | 1.0.2 |
| Local indexer | 4.3.3-hotfix |
| Next.js | 15.5.25 |

`package-lock.json` locks transitive dependencies. Multiple ledger WASM package instances are incompatible; retain the override and use `npm ci`. Research and official sources: [`docs/midnight-research.md`](docs/midnight-research.md).

## Testing

```bash
npm run contract:check       # generated execution only; no keys
npm test                    # compiled-contract constraints and state privacy
npm run typecheck
npm run build
npm run test:ui              # dev server at :3000; requires Chrome
npm run test:e2e             # real disposable local chain, funded test wallet, ZK proof
VEILPASS_BROWSER_E2E=1 npm run test:e2e  # same plus real browser/connector flow
```

Always run `contract:compile` before proving. `test:e2e` creates its own Docker environment, waits for a funded genesis wallet, deploys, authorizes, rejects the invalid credential and replay, inspects public output, writes public evidence and tears down its own chain. It does not spend production funds. Browser E2E bridges a **real local funded wallet** through the official connector adapter; it does not mock proofs or acceptance.

`test:ui` tests encryption, unlocking, no-wallet state and responsive layout without pretending to authorize. Full network tests take minutes. ZK proofs are CPU intensive.

## Deployment

For an interactive Preprod session:

1. Copy `.env.example` to `apps/web/.env.local` and retain `NEXT_PUBLIC_NETWORK=preprod`.
2. Run `npm run proof-server` (binds loopback port 6300), then `npm run dev`.
3. Obtain a compatible wallet, choose Preprod, and fund it using the [official Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/). Wait for spendable DUST.
4. In the UI, get a demo credential, connect the wallet, open **Verify eligibility → Developer setup**, and deploy the batch.
5. Save the returned address in `NEXT_PUBLIC_CONTRACT_ADDRESS` and restart the frontend. Verifiers must trust this issuer deployment, not an arbitrary address supplied by a holder.
6. Generate a private proof. A successful result includes the actual confirmed transaction ID.

No Preprod wallet, credentials or funds are embedded. Browser extension approvals remain in the user's wallet. The local E2E test is a reproducible deployment to a real **local** Midnight environment, not evidence of public Preprod deployment.

## Security & trust assumptions

Trusted: demo issuer and deployment authority; Midnight cryptography; correctly compiled contract; frontend and holder device; local proof service. The frontend can steal unlocked witness data if compromised, but cannot make the pinned contract accept altered committed fields without violating cryptographic assumptions.

Not given credential attributes by the protocol: the public ledger and verifier. The issuer is also the web host in this development demo and already knows its shared samples. This deployment arrangement does not demonstrate organizational separation between issuer and verifier.

## Current limitations

- Two shared bearer credentials, not unique per-user credentials; no identity validation or non-transferability.
- Exactly one successful authorization per credential and application scope. Replaying the demo requires a new deployment/batch scope if another success is needed.
- Tiny, known demo batch does not provide meaningful anonymity against inference or issuer correlation.
- Transaction timing, wallet-related metadata and public nullifiers remain observable.
- No revocation, expiry enforcement, recovery, audited production deployment or access-session token.
- Positive ledger/transaction inspections are not a full privacy audit. Exact-year byte scanning would be meaningless for a small integer; circuit disclosure and state structure are the relevant checks.
- Browser extension interoperability and public Preprod deployment require validation with the user's installed wallet.

## Buildathon roadmap

Wave 1 delivers the constrained credential primitive and documents its limits. Public Preprod deployment and external-wallet walkthrough remain deployment tasks for an operator with a funded wallet.

### Wave 2

Issuer registry, revocation, more schemas, reusable policies, production issuance and holder-bound credentials.

### Wave 3

Policy composition, cross-application use, developer integrations and production hardening.
