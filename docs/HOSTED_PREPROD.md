# Hosted Preprod release

Status: Render Free backend deployed on 2026-10-20; public frontend remains a preview while integration acceptance and Preprod proving are incomplete. Local proof evidence does not establish a public Preprod contract deployment.

Provider selected: Render. The authenticated account can access the GitHub repository. Deployment configuration lives in `deploy/render/`. The live backend is https://veilpass-preprod.onrender.com (service `srv-dbbn1hc9v7es73fp60t0`), deployed from commit `28c0f941412ad13c90f0de094e0ac8a963c3eaaa` on the Free plan. Render automatic deployment is set to After CI Checks Pass. Blockfrost connectivity from `.env.prepod` passed for both RPC and indexer; this does not establish contract compatibility. The operator requires free plans only and explicitly authorized a temporary Docker restart followed by shutdown. Render Free uses the existing Neon Free project for external Postgres; no paid compute or disk was provisioned.

The existing Neon `veilpass` Free project is now initialized with encrypted authority state and durable challenge/rate-limit tables. Private Render configuration is retained in owner-only `.private/hosted-preprod/render.env`, excluded from Git and Docker. The approved variables are stored in Render. Its first deployment succeeded and startup verified the pinned persistent issuer identity; the public hosted HTTP journey passed signed holder enrollment/issuance, both local signature policies and revocation; see `evidence/hosted-journey.json`. This is not a network proof. Vercel Production now has `VEILPASS_BACKEND_ORIGIN=https://veilpass-preprod.onrender.com`; the production redeployment `6ozuEvpJJYYFj8MsDwieAjjniSpF` is Ready and assigned to `useveilpass.vercel.app`. Browser inspection confirmed public trust JSON on the direct Render issuer endpoint. The frontend issuer URL returns the pinned trust JSON, and the actual hosted signed-issuance/revocation journey passed. Free-tier cold starts still require bounded retries. Actual proof trials on proof-server 8.1.3 were OOM-killed at both 512 MiB and 2 GiB; this blocks Render Free hosted proving, not the separate issuance/database work.

## Release architecture

- Keep the public frontend at https://useveilpass.vercel.app, automatically deployed from GitHub main.
- Run the signed issuer and verifier on Node 24 with external Postgres for durable encrypted authority state, challenges and rate limits. Local development retains SQLite. Render Free needs no persistent disk with this adapter.
- Keep Blockfrost credentials server-side. Proxy only the GraphQL operations and subscriptions actually required by the pinned SDK; do not expose an unrestricted upstream proxy.
- Provide HTTPS proving behind bounded requests, concurrency limits and an explicit user acknowledgement that the prover receives private witnesses. Do not expose an unauthenticated raw prover or claim browser-only privacy for remote proving.
- Store generated proving assets as versioned artifacts; record their hashes and pin verification keys independently on the verifier. Git pushes must not generate new issuer identities or deploy replacement contracts automatically.

## Required operator inputs

- Connect the operator-created Neon Free project. No paid resources or chargeable overages are authorized.
- Create/select a Midnight Preprod Blockfrost project; enter its token through the provider secret UI or an ignored local file.
- Approve Lace connection and deployment transactions. Keep recovery phrases and wallet keys out of chat and source control.
- Select the initial trusted issuer/operator and the recovery contact/process.

## Ordered implementation and acceptance

1. Add explicit public HTTPS origin validation, bounded bodies, request deadlines, authentication and durable abuse controls. Preserve local development behavior and disabled Vercel defaults until hosted mode is explicitly configured.
2. Package the backend, persistent volume and prover with health/readiness checks. Validate restoration of the encrypted database and storage key together; validate challenge persistence across restarts.
3. Implement a constrained Blockfrost HTTP/WebSocket gateway and test token redaction, origin enforcement, upstream failures and subscription cleanup.
4. Integrate remote proving with consent, TLS, request limits, cancellation and safe retries. Ensure private payloads are not logged.
5. Provision secrets and hosting; verify network compatibility against the current Midnight support matrix and run the read-only provider check.
6. Confirm funded wallet DUST generation; deploy V3 through an explicitly approved wallet transaction. Record network, contract address, transaction, issuer registry, circuit-key hashes and deployment configuration.
7. Publish signed configuration and versioned assets. Connect the hosted frontend to the deployed services; remove preview notices only for capabilities that actually work.
8. Test with installed Lace: approvals, rejection, disconnect, incorrect network, slow proof, retry after confirmed submission and refresh/recovery.
9. Run two independent application authorizations, replay rejection and on-chain status publication followed by revocation rejection. Record actual Preprod references.
10. Verify GitHub-triggered deployment from a fresh checkout, database preservation, rollback, uptime checks, backup recovery and secret rotation. Complete accessibility review, independent security review and an issuer/two-application pilot before a production-readiness claim.

## Completion rule

A successful Vercel build is frontend deployment only. The release is accepted only after the hosted browser journey and persistence/recovery checks pass against the recorded Preprod contract. Mainnet is a separate release decision.
