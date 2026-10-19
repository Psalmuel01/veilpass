# Deployment and reproducibility

## Local commands

```sh
nvm use                         # 22.22.0; do not use host Node 20
npm ci
npm run toolchain:install        # if Compact 0.31.1 is absent
npm run contract:check
npm run lifecycle:check          # generated JS/constraints; no proving keys
npm test
npm run typecheck
npm run build
VEILPASS_WORKBENCH=1 npm run dev
```

Open `http://127.0.0.1:3000/lifecycle`. Developer workbench is disabled without its opt-in flag and rejects non-loopback/non-same-origin writes. `/` preserves the legacy proof-backed wallet application; `/developers` explains the source SDK. No live hosted V2 URL exists.

## Real proof artifacts and local network

```sh
npm run lifecycle:compile        # 3 circuits: authorize, revoke, deactivateIssuer
npm run test:lifecycle:e2e       # Docker node, indexer, prover, funded local wallet
npm run contract:compile        # existing legacy proof artifacts
npm run issuer:setup            # once; refuses overwrite
npm run test:e2e                # legacy local-chain flow
```

The V2 harness deploys its own sample batch, proves both policy/audience pairs, checks consumed keys, rejects replay, confirms issuer revocation and rejects new requests in both applications. It writes `docs/evidence/lifecycle-network.json` only after every assertion succeeds. Generated bindings/keys are ignored; reproduce from source and pins. Failed key generation must not be interpreted as a successful artifact build.

## Current blockers

19 October: Docker daemon unavailable at `/Users/sam/.docker/run/docker.sock`; attempting to open Docker Desktop reports that application is not installed. Thus no fresh V2 network deployment/proof run exists. Compact generated-execution compilation passes. Full key generation initially failed under sandbox permissions; automatic approval review then failed (reviewer capacity, followed by deadline timeout). Neither failure establishes a cryptographic/compiler defect, and no successful V2 key generation is claimed.

Npm dependencies required authorized network download; 603 packages installed successfully. Loopback servers/browser checks require execution permission in restricted environments. See validation evidence for actual later results.

## Preprod

Network target: Preprod. Compiler 0.31.1, runtime 0.16.0, SDK Midnight.js 4.1.1, Compact JS 2.5.1, ledger 8.1.0, connector 4.0.1. Keep exact package lock and proof-server 8.1.0.

No V2 contract address, transaction reference, funded wallet or public frontend deployment is supplied. Do not invent them. Legacy deployment UI and provider code remain available, but deploy the V2 contract separately with its eight constructor arguments and V2 compiled assets. A verified V2 deployment adapter/frontend wiring is still required before production use. The SDK currently has an interface for finalized-chain evidence, not a completed V2 Preprod adapter.

Before public deployment, resolve credentials/signature integration, wallet custody, signed artifact provenance, TLS, actual current endpoints from the [network release notes](https://docs.midnight.network/relnotes/network), and contract pinning. Record deployment transaction, address, finalized authorization transactions, revocation transaction and serialized-output privacy checks. Do not substitute ephemeral local IDs for Preprod IDs.

Dependency validation: Next.js is now pinned to 15.5.28, Vitest 5.0.5 with supported Vite 7.3.6, ws 8.22.0, and PostCSS override 8.5.28. The final npm audit reports zero known advisories. Midnight direct dependency pins remain unchanged.
