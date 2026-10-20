# Get the accounts and services needed for Preprod

Updated 20 October 2026. The Vercel website is a frontend preview. It does not supply a funded wallet, a persistent issuer database, or a trusted prover.

## 1. Node and indexer access

Create an account at [Blockfrost](https://blockfrost.io/) and create a **Midnight Preprod** project. Save its project token locally as `BLOCKFROST_PROJECT_ID`. A Mainnet project token will not work on Preprod.

The [official environment reference](https://docs.midnight.network/relnotes/network) lists:

| Service | Base URL |
| --- | --- |
| Node RPC | `https://rpc.midnight-preprod.blockfrost.io` |
| Node WebSocket | `wss://rpc.midnight-preprod.blockfrost.io` |
| Indexer GraphQL | `https://midnight-preprod.blockfrost.io/api/v0` |
| Indexer WebSocket | `wss://midnight-preprod.blockfrost.io/api/v0/ws` |

Each URL needs `?project_id=<your-token>`. The old Midnight-hosted Preprod endpoints were retired on 9 October 2026. Do not reuse those URLs from older examples.

Create an ignored `.env.preprod` file containing:

```dotenv
BLOCKFROST_PROJECT_ID=your_midnight_preprod_project_id
```

Replace the placeholder locally, then run this read-only check from the repository root:

```sh
nvm install
nvm use
npm run preprod:check -- .env.preprod
```

The check reports connectivity, node version and indexed height without printing your token or authenticated URLs. It is not proof of ledger/compiler/wallet compatibility. Before submitting a transaction, compare the live network with the [support matrix](https://docs.midnight.network/relnotes/support-matrix), the repository's pinned stack and the actual indexer schema. The local V3 stack is ledger 8.1.0, Compact 0.31.1 and runtime 0.16.0. Do not upgrade or downgrade individual components blindly.

## 2. Fund an operator wallet

Install [Lace](https://www.lace.io/), create or select a Midnight test wallet, and select **Preprod**. Back up its recovery phrase privately.

Copy the **unshielded** address beginning `mn_addr_preprod1…`. Open the [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/), paste the address and complete its captcha. Once tNIGHT arrives, register it for DUST generation in the wallet. NIGHT balance alone does not establish that the wallet has DUST for fees. Follow the [official funding guide](https://docs.midnight.network/guides/acquire-tokens).

Use the wallet extension for deployment approvals when possible. Do not paste the recovery phrase or signing seed into chat, source files, public environment variables or logs. A public wallet address is safe to share for checking funding.

## 3. Prove on the holder's device initially

The prover processes private witnesses. Start with a local loopback prover controlled by the holder, even when the frontend is hosted on Vercel. The [deployment guide](https://docs.midnight.network/guides/deploy-and-operate) uses this model too.

For the repository's **local test stack**, proof-server 8.1.0 is pinned in `compose.local.yaml`. The [official support matrix](https://docs.midnight.network/relnotes/support-matrix), checked 20 October 2026, lists **8.1.3** for Preprod with Compact 0.31.1/runtime 0.16.0. For the initial Preprod wallet setup, run:

```sh
docker run --rm --name veilpass-preprod-prover -p 127.0.0.1:6300:6300 midnightntwrk/proof-server:8.1.3
```

This keeps the prover bound to your device. Confirm `http://localhost:6300/version` answers, then select the local prover in Lace's Midnight settings. Stop the container when finished. Public-network acceptance still requires the live node/indexer/schema checks and a funded wallet.

A shared remote prover is an additional trusted service, not a privacy-neutral replacement. Never put a wallet signing seed in a proof witness. The V3 contract receives credential and presentation signatures, not the holder's signing seed.

## 4. Persistent issuer and verifier hosting

Vercel's function filesystem is not a persistent issuer database. `/api/issuance` deliberately refuses to run on Vercel. The local service uses an owner-only encrypted SQLite authority database and a separate durable SQLite verifier challenge store. A hosted service needs a server with persistent storage or a deliberately implemented transactional hosted-database adapter, HTTPS, authenticated administration, secret management and backups.

Do not buy hosting yet just to bypass this gate. Finish the local proof-backed acceptance test, decide whether the pilot can use a local trusted prover, then size and select hosting using measured requirements. Multi-user issuer accounts, authorized institutional onboarding, recovery-authorized reissuance and key rotation still need a production design and review.

## Deployment acceptance

A completed Preprod deployment must record the actual contract address, circuit verification-key hashes, network ID, trusted issuer key/registry, funded-wallet approval, two successful application authorizations, replay rejection, revocation publication and rejection after revocation. A successful Vercel push alone does not complete these steps.

## Public browser access to the indexer

Keep a server-owned Blockfrost project token on the server. The V3 public browser configuration rejects query-string tokens. Before public rollout, implement an authenticated/rate-limited backend gateway or agree a deliberately scoped client-access policy; do not copy your privileged project URL into public UI configuration.
