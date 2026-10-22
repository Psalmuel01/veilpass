# Render Free Preprod deployment

Deployed at https://veilpass-preprod.onrender.com on Render Free with Neon Free. The operator requires $0 hosting: never provision a paid service or disk. Hosted signed issuance/revocation passed; hosted Midnight proofs are not enabled.

Render can access `Psalmuel01/veilpass`. The native Node service uses `npm ci --include=dev && node scripts/render-build.mjs` and `node scripts/render-start.mjs`, with Node pinned to 24.22.0. The separate Dockerfile reproduces a clean Linux build for validation. The Blueprint selects `plan: free`, no disk, and external Postgres. Render Free sleeps on idle and can discard every local file on restart. Its own free Postgres expires after 30 days, so the intended database is a Neon Free project. These free services are a bounded Preprod pilot, not a production uptime guarantee.

## Prepared configuration

- `Dockerfile`: pinned Node 24.22.0, checksum-verified Compact 0.31.1, fresh dependency install and Next.js production build. Credentials are never build arguments.
- `.dockerignore`: excludes environment files, private directories, wallet/SQLite data, caches and generated assets.
- `render-build.mjs`: generates contract JavaScript, then installs the public Preprod artifacts from the pinned GitHub release. Archive, source and individual file hashes must match `deploy/preprod/artifacts.json`. It does not generate proving keys on Render Free.
- `entrypoint.sh`: runs the application as the unprivileged Node user. Postgres mode does not require a disk.
- `render-start.mjs`: validates configuration, runs database preflight, forwards termination signals and listens on Render's assigned port. It derives the exact public origin from `RENDER_EXTERNAL_URL` unless explicitly configured.
- `render.yaml`: one free backend, Git deployments after passing checks, stable operator-supplied encryption/admin secrets, and manually supplied database/Blockfrost configuration. Hosted network authorization stays disabled.
- `/api/health`: liveness only, not chain/prover readiness.

## Durable state

`integrations/issuance/src/postgres.ts` stores the encrypted authority snapshot, pinned public identity fingerprint, verifier challenges, consumed requests and global rate budgets in Postgres. Optimistic updates prevent concurrent operations from overwriting each other. Challenge consumption and rate admission are atomic database statements. Remote connections always validate TLS certificates; URL query parameters cannot disable verification. There is no fallback from a missing hosted database to ephemeral SQLite.

The actual disposable Postgres acceptance test, containerized HTTP journey and deployed signed-issuance journey passed: issuance, concurrent offers, failed-operation rollback, revocation, restart continuity, namespace isolation, atomic replay rejection, expiry and durable rate limits. Run `scripts/postgres-check.ts` only against the explicitly disposable loopback database; never point it at Neon.

## Remaining release steps

1. The existing Neon `veilpass` Free project was connected and initialized with the real encrypted authority. Stable secrets and the public fingerprint are stored locally in owner-only `.private/hosted-preprod/`. Transfer `render.env` to Render's secret settings only with the operator's authorization; keep it out of Git and chat.
2. Clean Linux image build/boot and actual HTTP issuance/revocation acceptance passed under a 512 MiB memory cap. The HTTP run used 1 CPU to avoid excessive x86-emulation throttling; it does not establish Render Free CPU performance or the public Vercel proxy journey.
3. Initialization was performed explicitly with `scripts/hosted-bootstrap.ts .env.prepod --create`. Render's configuration uses bootstrap **off** and pins the resulting public fingerprint. Never generate a new storage key for this database or turn bootstrap on to recover from storage loss.
4. Configure backups/export and validate restoration with the matching encryption key. Provider free-tier retention is not a substitute for application recovery testing.
5. The restricted Blockfrost HTTP/WebSocket gateway is implemented and real read-only acceptance passed. Public activation still requires `VEILPASS_SIGNED_NETWORK=1` after authorization acceptance.
6. Establish a working prover within the zero-dollar constraint. No shared public prover, remote-witness privacy claim, or 512 MB proof success is assumed. The actual 8.1.3 V3 proof was OOM-killed at both 512 MiB and 2 GiB in disposable local trials; see `docs/evidence/free-prover-feasibility.json`. Hosted network proofs therefore remain blocked under Render Free.
7. The actual contract is deployed through the dedicated terminal operator; address, key hashes and confirmation are recorded in `docs/evidence/preprod-terminal.json`. Hosted browser and installed-wallet acceptance remain separate gates.
8. Check the workspace's usage/spend settings before service creation. A free compute plan does not guarantee that bandwidth or build overages are free when a payment method exists. Do not accept chargeable overages under the operator's $0 authorization.

## Secrets and recovery

The operator's Blockfrost token lives in the ignored `.env.prepod` file (the actual spelling). Verify connectivity without exposing it:

```sh
nvm use
npm run preprod:check -- .env.prepod
```

Keep issuer storage/admin secrets stable across redeployments. Back up encrypted authority state and its matching storage key separately from Git. Do not upload `.private` or run `dev:signed` as a hosted start command. If the hosted authority is absent after bootstrap, restore its backup instead of generating a replacement identity.

Named operator access, storage-key rotation, encrypted recovery drills and readiness monitoring are documented in [OPERATIONS.md](../../docs/OPERATIONS.md). Signing-key rollover, external review and the real Preprod pilot remain separate gates.

The public gateway accepts only the exact read-only documents of Midnight.js 4.1.1, scopes contract reads to the deployed address, bounds transaction-stream history, limits requests/connections/operations/lifetime/output, and injects Blockfrost authentication only on the server. Render exposes the gateway and forwards other HTTP traffic to a loopback-only Next process. Browser proving files are served by Vercel; the holder runs a trusted loopback prover.
