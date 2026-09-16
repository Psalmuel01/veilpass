# Architecture

## Components

- `contracts/veilpass/veilpass.compact`: fixed issuer batch, private constraints, authorization set.
- `packages/credential/index.ts`: typed credential envelope, encoding, generated Compact pure hashes, witnesses.
- `packages/credential/memory-provider.ts`: contract-scoped session state for Midnight.js. No persistent plaintext.
- `scripts/issuer-setup.ts`: creates two demo records, their sibling commitments and constructor inputs. Private records are ignored by Git and created with owner-only permissions.
- `apps/web/app/api/credential/route.ts`: demo issuer delivery. Same-origin POST; no-store response. No verifier receives this payload during proving.
- `apps/web/lib/vault.ts`: local encrypted storage; PBKDF2-SHA256 (310,000 iterations), random salt, AES-GCM-256 with fresh 96-bit IV. Passphrase stays in browser memory and is cleared after use.
- `apps/web/lib/midnight.ts`: connector discovery, network check, address decoding, local proof provider, indexer provider, wallet transaction balancing and submission. Reads confirmed state before displaying success.
- `scripts/local-e2e.ts`: actual Docker node/indexer/prover, funded testkit wallet, deployment and network assertions.
- `scripts/browser-e2e.ts`: full UI backed by the official adapter to the real local wallet, no simulated transaction outcomes.

## Issuance and authenticity

The issuer creates C0 (2024), C1 (2018), each with an independent 256-bit random secret. Compact persistentHash commits schema, issuer, subject, degree, year, student ID, issuance time and secret. The root hashes a domain tag plus both commitments. Constructor arguments establish that root, issuer and application scope as the verifier's trust anchor.

The two-leaf membership circuit calculates the root privately from the credential, sibling and direction. There is no public per-credential registration and no mutable issuer registry. This deliberately limits Wave 1 to a fixed demo batch. A holder cannot choose new data or a new sibling that matches the root without breaking hash assumptions.

## Authorization

The circuit checks schema, approved issuer, membership, threshold and nullifier freshness. It discloses only the application-scoped nullifier, inserting it into public state. Authorize has no explicit credential arguments; private witnesses supply the data. Public policy is fixed by deployed code.

The browser queries the trusted contract, checks batch/app scope, creates witness state, invokes the generated contract through Midnight.js, sends private proof material only to the loopback prover, asks the wallet to balance the proven transaction and submits it. The indexer must report `SucceedEntirely`, and the confirmed ledger must contain the expected nullifier.

## Failure paths

Local constraint failure prevents proof construction. The UI displays a generic eligibility failure rather than the failed private attribute. Proof-server/network failure and wallet rejection do not produce a receipt. Repeated nullifiers fail. The UI cannot establish authenticity by evaluating a JavaScript Boolean alone.

## Deployment authority

The public contract address, not a wallet label or frontend checkmark, identifies the issuer trust anchor. Developer setup is an operator convenience. A production verifier must configure this address itself. Deployment maintenance signing keys are session-only in the browser provider; this prototype provides no upgrade UI or key recovery. The issuer/deployer remains trusted under the protocol's maintenance model.
