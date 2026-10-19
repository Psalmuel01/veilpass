# Architecture

## Components

| Path | Role |
|---|---|
| `contracts/veilpass/veilpass.compact` | Fixed issuer batch, private constraints, authorization set |
| `packages/credential/index.ts` | Credential envelope, encoding, pure hashes, witnesses |
| `packages/credential/memory-provider.ts` | Contract-scoped session state, no persistent plaintext |
| `scripts/issuer-setup.ts` | Builds the two demo records, siblings and constructor inputs |
| `apps/web/app/api/credential/route.ts` | Demo issuer delivery over same-origin POST, `no-store` |
| `apps/web/lib/vault.ts` | Encrypted local storage: PBKDF2-SHA256 (310k), AES-GCM-256 |
| `apps/web/lib/midnight.ts` | Connector discovery, providers, balancing, submission |
| `scripts/local-e2e.ts` | Docker node/indexer/prover, funded wallet, network assertions |
| `scripts/browser-e2e.ts` | Full UI against the real local wallet via the official adapter |

Issuer files are written with owner-only permissions and gitignored. No verifier sees the credential payload during proving.

## Issuance and authenticity

The issuer creates two credentials — C0 (2024) and C1 (2018) — each with an independent 256-bit secret. `persistentHash` commits schema, issuer, subject, degree, year, student ID, issuance time and secret. The root hashes a domain tag with both commitments. Constructor arguments fix that root, the issuer and the application scope as the verifier's trust anchor.

Membership is verified privately: the circuit recomputes the root from the credential, its sibling and the direction bit. There's no public per-credential registration and no mutable registry, which keeps Wave 1 to a fixed batch. A holder can't pick new data or a new sibling that still hashes to the root without breaking the hash assumptions.

## Authorization

The circuit checks schema, approved issuer, membership, the year threshold, and nullifier freshness. It discloses only the nullifier, which it inserts into public state. `authorize` takes no arguments — private witnesses supply everything, and the policy is fixed by the deployed code.

The browser queries the pinned contract, confirms the batch root and scope match the credential, builds witness state, calls the contract through Midnight.js, sends witness material only to the loopback prover, then has the wallet balance and submit the proven transaction. Success requires the indexer to report `SucceedEntirely` and the confirmed ledger to contain the expected nullifier.

## Failure paths

A constraint failure stops proof construction, and the UI reports a generic eligibility failure rather than naming the attribute that failed. Prover, network and wallet-rejection failures produce no receipt. Repeated nullifiers fail. A JavaScript boolean alone never establishes authenticity.

## Deployment authority

The contract address identifies the trust anchor — not a wallet label or a checkmark in the UI. Developer setup is an operator convenience; a production verifier configures the address itself.

Maintenance signing keys live only in the browser provider for the session. There's no upgrade UI and no key recovery, so the issuer/deployer stays trusted under this model.
