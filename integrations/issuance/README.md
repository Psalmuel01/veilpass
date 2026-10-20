# Signed issuance and V3 authorization

This package is now an npm workspace of the Node 24 app. Install with **`npm ci` from the repository root**. Do not install an isolated copy of Midnight's WASM runtime here: duplicate runtimes reject each other's native objects during real deployment.

The browser holder/issuer screens, encrypted durable authority, V3 contract, verifier and test instructions are documented in [the signed issuance guide](../../docs/SIGNED_ISSUANCE.md). Actual local-network proofs and confirmed V3 verification are recorded in [network evidence](../../docs/evidence/signed-network.json). This is not a public Preprod deployment.

## Module checks

From the root:

```sh
nvm install                     # first setup only
nvm use
npm ci
npm run toolchain:install
npm run signed:check
npm test --workspace @veilpass/issuance
npm run typecheck --workspace @veilpass/issuance
npm run demo --workspace @veilpass/issuance
```

`npm run validate --workspace @veilpass/issuance` records generated-execution tests and the local signing/recovery demo separately from the real network evidence. Full proof artifacts require `npm run authorization:compile --workspace @veilpass/issuance`; key generation alone is not a confirmed transaction. The browser workflow runs with `npm run dev:signed`.

The exact library pins are `credential-compact`/`credential-model` 0.3.0, runtime 0.16.0 and `midnight-did-jubjub-schnorr` 0.7.0, with Compact 0.31.1. The signing adapter uses official VC context/challenge functions and DID seed/key helpers, a fresh rejection-sampled nonce and the standard Schnorr response. DID payload signatures use a different challenge and must not replace VC signatures. This composition needs independent review before production.

## Trust boundaries

`IssuerAuthority.approve(level, holderIdentity)` approves claims for an exact public holder identity; `Holder.request` signs enrollment without disclosing a signing seed. `issue` is one-shot; `issueOrResume` supports authenticated short-lived transport recovery without duplicate credentials. `Holder.accept` checks a pinned issuer and holder ownership. `Holder.present` signs an exact contextual presentation. `LocalVerifier` runs actual generated signature constraints but returns the explicit `local-signed-credential` mode; it is not a remote privacy-preserving authorization API.

`Holder.backup` and `Holder.restore` use the same authenticated Web Crypto format as the browser. `saveHolderBackup`/`loadHolderBackup` add exclusive owner-only filesystem storage. Backup restoration validates ownership and embedded signatures, but does not establish independent issuer trust or bypass current revocation. Forgotten passwords, lost-all-backup recovery and holder-key rotation require separate workflows.

The local authority service persists encrypted state with SQLite optimistic concurrency and an owner-only storage key. Its admin token authenticates one operator, not an institution. `/api/issuance` and `/api/signed-network` require configured loopback services and are unavailable on Vercel. Vercel's filesystem is not durable issuer hosting.

The separate V3 ledger accepts official signature witnesses, a private current-status path and public request context. Holder signing seeds never enter the circuit or prover. Status-root publication must be confirmed on-chain after a local issuance or revocation. The verifier pins three V3 circuit keys, current issuer/registry/domain and canonical finalized transactions; durable challenge consumption rejects replay across restarts.

JavaScript memory is not a hardware-backed keystore. Issuers still know the approved claims, holder enrollment public keys and status handles. Timing and transaction metadata remain observable. Neither a signature nor an on-chain proof establishes an institution's legitimacy or a person's identity by itself.

References: [Midnight identity](https://docs.midnight.network/concepts/identity), [official VC project](https://github.com/midnightntwrk/midnight-verifiable-credentials), [DID project](https://github.com/midnightntwrk/midnight-did).
