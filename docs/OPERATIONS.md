# Hosted issuer operations

This is a bounded Preprod pilot. The single trusted issuing organization can have multiple named operators. A role account authenticates an operator; it does not establish an organization's legitimacy or completion of training. Verify those facts outside the application before approving an enrollment.

## Operator access

Use Node 24. If direct database TCP access is unavailable, prefix administrative commands with `VEILPASS_DATABASE_TRANSPORT=neon-http` to use Neon’s official HTTPS driver against the same pinned `neon.tech` database endpoint. This changes only the local administrative transport; the Render backend retains verified Postgres TLS. Keep the private configuration and issued credentials out of Git, logs, chat and build artifacts.

```sh
node --import tsx scripts/operator-admin.ts .private/hosted-preprod/render.env list
node --import tsx scripts/operator-admin.ts .private/hosted-preprod/render.env create psalmuel administrator 90
node --import tsx scripts/operator-admin.ts .private/hosted-preprod/render.env create training-operator issuer 30
node --import tsx scripts/operator-admin.ts .private/hosted-preprod/render.env create status-operator revoker 30
node --import tsx scripts/operator-admin.ts .private/hosted-preprod/render.env rotate training-operator issuer 30
node --import tsx scripts/operator-admin.ts .private/hosted-preprod/render.env disable training-operator
```

New random credentials are written exclusively to owner-only JSON files under `.private/hosted-preprod/operators/`. Only SHA-256 domain-separated digests of these 256-bit random tokens are stored in Postgres. Passwords are not accepted. Rotation replaces the old digest immediately; disabled and expired credentials cannot authenticate. User-selected role and expiry changes require offline database administration. There is no public account-provisioning endpoint.

Use the token field at `/issuer`; tokens remain in page memory. `issuer` can approve holder-bound offers, `revoker` can revoke, and `administrator` can do both and deactivate the issuer. Authority mutations and their actor/action/version audit events commit in the same SQL statement. Audit rows contain no tokens, holder keys, credential claims or witness data. The table is operational evidence, not a tamper-proof log against a database administrator.

The original `VEILPASS_ISSUER_ADMIN_TOKEN` remains a recovery administrator during migration. After validating a named administrator, set `VEILPASS_RECOVERY_ADMIN_DISABLED=1` on Render and redeploy to disable that path. Keep the recovery secret offline; do not disable it before testing a replacement account. A role check happens on each request, not only at sign-in.

## Encrypted authority backup and recovery

```sh
node --import tsx scripts/authority-recovery.ts .private/hosted-preprod/render.env backup
```

This saves an encrypted authority snapshot, fingerprint and authority revision to an owner-only file under `.private/hosted-preprod/backups/`. Keep a separate copy of the matching encryption key and a separate database/provider backup. This snapshot covers signing state, offers, issued status and retry receipts. It does **not** back up operator accounts, audit history, rate budgets or verifier challenges. Database-level backups are required for complete recovery. Never rely on a provider's free retention period alone.

For an isolated recovery drill, create an empty disposable database and private environment file with its connection URL, the original storage key and the pinned fingerprint, then run:

```sh
node --import tsx scripts/authority-recovery.ts /private/path/recovery.env restore-empty /private/path/authority-backup.json
```

Restore refuses to overwrite an existing issuer, rejects another identity and checks authenticated decryption. In a real incident, stop writes, disable network authorization and reconcile all revocations after the backup's capture time before resuming issuance or publishing any on-chain status. A stale backup can resurrect revoked status. Missing challenges must fail closed; never fabricate or mark old requests unused. Restore database-level operator/audit data separately or reprovision named operators offline. Confirm the public fingerprint, test a revoked credential, and run a new holder journey against the recovery target before changing routing. Do not perform disaster-recovery drills on the live database.

## Storage key rotation

Stop writes first. Prepare a private replacement environment file containing a different high-entropy `VEILPASS_ISSUER_STORAGE_KEY`, then run:

```sh
node --import tsx scripts/authority-recovery.ts .private/hosted-preprod/render.env rotate-storage-key /private/path/replacement.env
```

The command saves an old-key backup before committing a compare-and-swap re-encryption. Update Render's storage secret and the private configuration before restarting. Verify readiness and fingerprint. Preserve the old backup and old key together. A failed concurrent update aborts rotation. A crash after the database commit requires the replacement key to restart; it does not justify bootstrapping another authority.

This rotates **storage encryption**, not the credential signing key. A signing-key compromise requires stopping issuance, deactivating affected network authorization, issuing a new versioned authority/contract, explicitly migrating verifier pins, re-enrolling affected holders and reconciling revocations. The current V3 contract pins one issuer; seamless multi-epoch signing-key rollover is not implemented. Never overwrite the pinned key and claim old credentials migrated.

## Readiness, monitoring and deployment

- `/api/health` is process liveness only.
- `/api/readiness` verifies a reachable database and the pinned authority row. `issuer-ready` does not establish the prover or chain is ready. It deliberately reports `productionReady: false` pending external acceptance.
- `node scripts/hosted-readiness.mjs` checks the public issuer fingerprint, rejects unauthenticated administration and untrusted origins, and checks issuer readiness. It logs no response body or credential. The Hosted issuer readiness workflow runs daily and manually; enable GitHub failed-workflow notifications for the operator.
- Render Free sleeps. JSON consumers must handle a temporary HTML wake-up response and bounded retry. Monitoring is daily, not an uptime guarantee.
- Pushes to `main` deploy Vercel; Render waits for CI checks. Issuer identities, credentials, keys and contracts must not be regenerated on push.
- Roll back application code through each provider while keeping the existing database and keys. Never roll back status data as an application rollback. Check schema compatibility first.

## External acceptance

The V3 Preprod deployment is confirmed in `evidence/preprod-terminal.json`. Before public production use: complete hosted proof acceptance, ensure an available trusted prover/status publisher, test installed Lace and mobile browsers, commission an independent security review, and run a consenting issuer/two-application pilot. Track issuance attempts/successes, proof and verification latency, rejection reasons and recovery success using aggregate measurements. Do not log private credentials or proof witnesses. External pilot results and independent findings must come from real participants; local regression tests are not a substitute.

## Preprod status publication

After issuance or revocation changes, run the dedicated operator's `publish --submit` command from [the hosted guide](HOSTED_PREPROD.md). It skips matching roots, rechecks freshness before submission and records canonical confirmation. Issuer API revocation alone does not update the contract root. Do not promise network revocation until publication confirms. Keep operator wallets and administrator secrets off Vercel/Render. Never run two operator wallet processes concurrently.

Public network activation is versioned in `deploy/preprod/activation.json` after complete acceptance; `VEILPASS_SIGNED_NETWORK=0` is an emergency backend kill switch. Git pushes carry reviewed config/artifact pins without generating new contracts or issuer identities.
