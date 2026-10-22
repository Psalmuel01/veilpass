# Terminal Preprod operator

Use Node 24 and the ignored `.private/hosted-preprod/render.env`. This tool uses a separate test operator, never your Lace seed. Keep the environment file and `.private/preprod-terminal/` private and backed up together: the issuer storage key decrypts the operator seed and synchronization checkpoints.

```sh
npm run preprod:terminal -- .private/hosted-preprod/render.env init
npm run preprod:terminal -- .private/hosted-preprod/render.env status
npm run preprod:terminal -- .private/hosted-preprod/render.env register --submit
npm run preprod:terminal -- .private/hosted-preprod/render.env deploy --submit
# Or synchronize, register when necessary, wait for DUST, and deploy once:
npm run preprod:terminal -- .private/hosted-preprod/render.env bootstrap --submit
```

`init` creates an encrypted seed only when none exists, checks recovery before saving, and prints only the public funding address. Fund that address using the official Midnight Preprod faucet. Do not fund a different generated wallet.

`status` synchronizes all three subwallets and reports public balances. Initial synchronization scans ledger history and can take considerably longer than the unshielded balance lookup. Restored wallets use supported larger event batches. It saves AES-GCM encrypted synchronization checkpoints every 30 seconds; subsequent runs restore those checkpoints. Progress counters are ledger indices, not percentages. A connected stream is not necessarily synchronized.

`register --submit` registers available test NIGHT outputs for DUST generation. Wait for confirmation and a positive DUST balance before deploying. A local proof server version 8.1.3 is required at `127.0.0.1:6300`; this is operator infrastructure, not the public website.

`deploy --submit` uses the existing contract administrator keys and a fresh hosted issuer status root. It records an attempt before deployment and refuses to automatically retry an existing attempt. Registration also records a submission attempt and refuses to overwrite it. After any uncertain submission, inspect the recorded transaction and chain state before taking further action. Do not delete the attempt file just to retry.

Deployment alone does not enable public proofs. Validate the deployment with `preprod:release`, expose authenticated/constrained network access and public proof artifacts, then test both applications, revocation, retries and restored holders before enabling hosted network readiness.

Hosting remains Vercel for the website, Render for the API, and Neon for storage. Neither wallet backups nor operator secrets belong in the frontend or Git.

## Confirm completion

Do not run a second wallet process while the operator is active. Inspect the public receipt files instead:

```sh
cat .private/preprod-terminal/registration.json
cat .private/preprod-terminal/deployment.json
npm run preprod:release -- .private/hosted-preprod/render.env .private/preprod-terminal/deployment-config.json
```

`registration.json` records submission, not independent confirmation. `deployment.json` is written after the deployment API reports confirmation and contains the contract address and transaction reference. Independently run the release check above to validate the current chain state, issuer/status root, application/domain pins and verifier keys. Its success report is `docs/evidence/preprod-release.json`. A missing deployment receipt or a lone attempt file must be treated as pending or unresolved, not successful.

The initial DUST scan may take tens of minutes or longer. Recovery checkpoints reduce restart work. Never remove attempt files or retry a transaction merely because a browser page or terminal timed out.
