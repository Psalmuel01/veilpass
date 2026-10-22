# Hosted Preprod proof flow

Use https://useveilpass.vercel.app as the public website. Render supplies issuer and verifier APIs plus a restricted HTTP/WebSocket indexer gateway; Neon stores encrypted issuer state and durable verifier challenges. The deployed V3 contract address is recorded in [deployment evidence](evidence/preprod-terminal.json).

Public proving files come from the immutable, hash-pinned release in `deploy/preprod/artifacts.json`. Both hosted builds verify the archive, every artifact and the contract sources/generated code before publishing `/zk-signed`. A source change requires a matching reviewed artifact release and, when verifier keys change, a new contract deployment. Never rebuild random keys for the existing contract.

The Render gateway accepts only exact read-only Midnight.js 4.1.1 operation documents. Contract queries are pinned to VeilPass; broad transaction subscriptions cannot start before its deployment. Origins, payloads, operations, request rate, connection count, lifetime, output and buffering are bounded. The Blockfrost token is injected only upstream on the backend. It is never returned in browser settings or shipped in assets.

The explicit `VEILPASS_SIGNED_NETWORK=1` backend setting activates public network settings, challenges and gateway access. Keep it disabled until the real Preprod acceptance runner passes. Vercel forwards `/api/signed-network` to Render. This setting does not imply production readiness, installed-wallet acceptance or a completed external pilot.

## Holder setup

1. Open the public Holder page and create or restore an encrypted holder wallet.
2. Request enrollment from the issuer; an authorized operator approves and issues the holder-bound credential.
3. Install/unlock a compatible Midnight wallet on Preprod and ensure it has spendable DUST.
4. Run a trusted local proof server, pinned to 8.1.3, on the holder's own machine:

```sh
docker run --rm --name veilpass-holder-prover --memory=6g \
  -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.3
```

5. Connect the installed wallet, select the application policy and request a fresh challenge. Approve the transaction in the wallet when prompted. Leave the prover running until proof generation completes.
6. Verify the confirmed receipt. Each challenge is consumed once; retry with a new challenge after expiry or rejection. A changed issuer status root requires a fresh authorization.

The loopback prover is holder infrastructure; the public application remains on Vercel. Render Free cannot run this prover within its memory allowance. Private proof witnesses must remain on the holder-controlled machine. Stop the temporary container when finished. A phone alone cannot run this Docker-based holder setup; mobile proof generation remains unverified.

Revocation changes the hosted credential status immediately, but network verifiers also need the new status root published to Preprod by the contract administrator. Until automated publication is implemented and tested, do not promise immediate chain revocation after clicking the issuer button. The acceptance runner explicitly publishes both issuance and revocation roots.

## Deployment and acceptance operations

The Render service is `srv-dbbn1hc9v7es73fp60t0` on the Free plan, with automatic deployment after GitHub CI passes. Vercel serves the canonical frontend and forwards issuer/verifier/readiness APIs to Render. Keep bootstrap disabled and preserve the existing issuer fingerprint and storage key across every deployment. Private settings remain in owner-only `.private/hosted-preprod/render.env` and provider secret storage, excluded from Git and build contexts.

Free-tier cold starts require bounded retries. Keep an encrypted authority backup and its matching storage key separately backed up, and validate recovery rather than generating a replacement issuer. Remaining release checks include fresh-browser installed-wallet approvals/rejections/disconnects, mobile behavior, restart continuity, rollback/recovery, operational key rotation, accessibility, independent security review and one issuer/two-application external pilot. Mainnet is a separate release decision. A successful website build or contract deployment does not complete these acceptance gates.

After issuing or revoking credentials, an administrator can publish the current status root with:

```sh
npm run preprod:terminal -- .private/hosted-preprod/render.env publish --submit
```

The operator validates the pinned contract and issuer, skips unchanged roots, checks again before submission that the issuer root has not changed during proving, submits once, and confirms the new root against the indexer. Attempt records block blind retries. Run this only when another operator wallet process is not active. Continuous status publication still requires an available trusted operator machine.
