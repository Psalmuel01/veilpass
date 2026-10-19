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

Open `http://127.0.0.1:3000/lifecycle`. Developer workbench is disabled without its opt-in flag and rejects non-loopback/non-same-origin writes. `/` is the public website; `/wallet` preserves the proof-backed wallet application; `/developers` explains the source SDK. No live hosted V2 URL exists.

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

The initial proof-key generation sandbox/approval failures are resolved: after the operator's follow-up approval, Compact 0.31.1 generated the real prover/verifier artifacts for all three V2 circuits. `docs/evidence/lifecycle-artifacts.json` records actual sizes and SHA-256 digests. Key generation is not a transaction proof or deployment.

Docker Desktop 27.5.1 became reachable during the follow-up. Its default Desktop credential helper stalled public image pulls even though no registry auth entries were configured. An isolated temporary Docker configuration (no credentials; explicit existing local daemon endpoint) allowed public pinned-image downloads without changing the user's settings. The real local-network lifecycle subsequently passed. `docs/evidence/lifecycle-network.json` records the actual contract address, deployment, two authorizations and revocation transaction references. Both policy verifications succeeded, replay failed, and fresh post-revocation authorizations failed. The harness shut down its disposable chain; these are not live Preprod identifiers.

Npm dependencies required authorized network download; 603 packages installed successfully. Loopback servers/browser checks require execution permission in restricted environments. See validation evidence for actual later results.

## Preprod

Network target: Preprod. Compiler 0.31.1, runtime 0.16.0, SDK Midnight.js 4.1.1, Compact JS 2.5.1, ledger 8.1.0, connector 4.0.1. Keep exact package lock and proof-server 8.1.0.

No public V2 Preprod contract address, transaction reference, funded operator wallet or hosted frontend deployment is supplied. Do not invent them. Legacy deployment UI and provider code remain available, but deploy the V2 contract separately with its eight constructor arguments and V2 compiled assets. The separate `/live` frontend and pinned chain adapter now provide real proving and confirmed SDK verification for an operator-configured V2 deployment. See [live setup](LIVE_V2.md). Preprod deployment and installed-wallet acceptance remain required before a public release.

Before public deployment, resolve credentials/signature integration, wallet custody, signed artifact provenance, TLS, actual current endpoints from the [network release notes](https://docs.midnight.network/relnotes/network), and contract pinning. Record deployment transaction, address, finalized authorization transactions, revocation transaction and serialized-output privacy checks. Do not substitute ephemeral local IDs for Preprod IDs.

Dependency validation: Next.js is now pinned to 15.5.28, Vitest 5.0.5 with supported Vite 7.3.6, ws 8.22.0, and PostCSS override 8.5.28. The final npm audit reports zero known advisories. Midnight direct dependency pins remain unchanged.

## Redesigned production preview

```sh
VEILPASS_BUILD_DIR=.next-redesign-build npm run build
VEILPASS_WORKBENCH=1 VEILPASS_BUILD_DIR=.next-redesign-build npm run start -- --port 3003
# In another terminal:
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 npm run test:v2:ui
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 node scripts/redesign-review.mjs
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 node scripts/ui-check.mjs
```

The last command opens the retained `/wallet` route and tests the encrypted-vault flow. Screenshots of the rebuilt public site and application live under `docs/screenshots/redesign/`. The rebuilt site does not change the V2 sandbox's execution mode.

## Validated Docker Desktop workaround

The successful run used a temporary anonymous Docker configuration because the Desktop credential helper stalled public image pulls. No existing Docker configuration or credentials were changed. On this macOS setup:

```sh
mkdir -p /tmp/veilpass-docker-config
cat > /tmp/veilpass-docker-config/config.json <<'JSON'
{"cliPluginsExtraDirs":["/Applications/Docker.app/Contents/Resources/cli-plugins"]}
JSON
DOCKER_CONFIG=/tmp/veilpass-docker-config \
DOCKER_HOST="unix://$HOME/.docker/run/docker.sock" \
npm run test:lifecycle:e2e
```

Check your actual endpoint with `docker context inspect` before adapting this to another installation. The harness separates image preparation (up to 30 minutes for the first download) from runtime health startup (180-second Compose readiness window). It uses only a funded disposable development wallet, records success after all assertions, and tears down its own chain. Initial download attempts timed out before this successful cached-image run; they are not presented as successful tests.

## Public Vercel preview

Public URL: **https://veilpass-beryl.vercel.app**

This deployment hosts the product interface and developer guide. The UI labels it as a public preview and links to the local setup. Local-only sample controls are disabled in the hosted workspace/reference applications. The workbench API remains disabled, and no live-chain or issuer configuration is uploaded. It does not provide a public proof-backed Midnight or Preprod deployment.

The Vercel project is `veilpass` under `psalmuel01s-projects`. It uses Node 22, the repository root, `vercel.json`, and a custom build hook at `scripts/vercel-build.mjs`. Fresh checkouts install the checksum-verified Compact 0.31.1 compiler and generate contract JavaScript with `--skip-zk` before building Next.js. The public preview does not need proof keys; generate them separately for local proofs.

`.vercelignore` excludes local credentials, environment files, caches, recordings, compiler/proof artifacts and node_modules. Do not upload `.private` or turn the loopback workbench into an unrestricted public service.

Redeploy from the repository root using an authenticated Vercel CLI:

```sh
nvm use
vercel deploy --prod --yes --build-env NEXT_PUBLIC_HOSTED_PREVIEW=1 --env NEXT_PUBLIC_HOSTED_PREVIEW=1 --env VEILPASS_WORKBENCH=0
```

The production URL is appropriate for the submission's Live demo field when described as the public product preview. The separate recorded video demonstrates the complete real local-network lifecycle.

Validation: `npm run test:hosted:ui` checks all seven public routes, preview notices, dark-mode persistence, mobile overflow, disabled workbench response, unconfigured live response and rejection of public live writes. The latest successful result is recorded in `docs/evidence/vercel-preview.json`.

The local-only API guards run before proof-library initialization, so the hosted preview can report disabled/unconfigured status without loading local-only WebAssembly dependencies.
