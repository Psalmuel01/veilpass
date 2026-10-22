# Preprod operator ceremony

The public product remains https://useveilpass.vercel.app. The private loopback operator console is an administrative bridge to installed Lace on the operator’s Mac, not another public website. It sends no wallet seed or password to VeilPass. Blockfrost credentials and issuer storage keys stay in the Node process.

Use Node 24. Back up the encrypted authority before the ceremony. Run the read-only connectivity and compatibility checks first:

```sh
npm run preprod:check -- .env.prepod
npm run preprod:compatibility -- .env.prepod
npm run preprod:subscription -- .env.prepod
npm run preprod:operator -- .private/hosted-preprod/render.env --check
```

The prepare/check command reads the current hosted authority without modifying it, creates stable contract administration keys in the owner-only ignored `.private/preprod-operator/keys.json` if absent, and records the deployment plan privately. Back up that key file securely and separately from this Mac before depending on the contract for revocation. It contains both the status administrator secret and contract maintenance signing key; never share, film or commit it. No wallet transaction is submitted by the check command.

The proof-server 8.1.3 synthetic trial succeeded with a 6 GiB limit. For the ceremony:

```sh
docker run -d --rm --name veilpass-preprod-prover -p 127.0.0.1:6301:6300 --memory=6g --cpus=2 midnightntwrk/proof-server:8.1.3
npm run preprod:operator -- .private/hosted-preprod/render.env
```

Open the session URL printed by the console in Edge. It is a temporary local authentication URL; do not publish it. The server binds only 127.0.0.1, checks Host/Origin, requires an HttpOnly SameSite session cookie, rejects unrelated wallet replies and serves no external scripts. Each process permits at most one deployment attempt.

1. Connect installed Lace on Preprod. Review the connection permissions in Lace yourself. This is not transaction approval.
2. Review the pinned issuer fingerprint, authority revision, status root, administrator commitment, audiences and circuit-key hashes. The console refuses a changed authority revision or unavailable/mismatched prover before attempting deployment.
3. Choose Prepare deployment for review. Review any wallet balancing/approval request in Lace yourself. Declining must not be treated as success.
4. Only after review, explicitly choose Submit approved deployment. The console does not submit automatically after balancing. Keep Preprod selected.
5. Wait for indexed confirmation. The console stores only public confirmation fields in `deployment.json`, and a token-free configuration draft in `deployment-config.json`. It never prints the private deployment object or signing key.
6. Run `npm run preprod:release -- .private/hosted-preprod/render.env .private/preprod-operator/deployment-config.json`. This checks deployed state, the existing issuer, all three verifier keys, both audiences, activity and indexed-head freshness.

An `attempt.json` record prevents automatic retries after a failure, timeout or restart. Its presence is not proof of submission or failure. Reconcile any recorded transaction reference and contract address through the canonical indexer/Lace before deciding whether another attempt is safe. Do not delete an unresolved attempt record simply to retry. A stale authority revision requires a refreshed plan, not silently publishing a stale root.

Stop the console with Ctrl-C and stop the temporary prover when finished. A local prover is an initial operator/holder-controlled option, not a continuously available hosted service.

## Public rollout remains separate

Do not set `VEILPASS_SIGNED_NETWORK=1` from this draft. Public configuration still requires a constrained token-free indexer HTTP/WebSocket gateway, versioned public proving assets, and both application authorizations/replay/on-chain revocation acceptance. Keep issuer keys and Blockfrost project tokens out of public config. Wallet/device acceptance, full database recovery, independent security review and the external pilot remain separate release gates.

## Connection troubleshooting

Lace can display an unlocked account in its sidebar while a separate Authorize DApp window is still locked. Complete the popup's own unlock and authorization flow. An incorrect-password message is a wallet authentication failure; VeilPass cannot bypass it. Keep passwords private. The connection helper now reports whether approval or network configuration is waiting, stops after 30 seconds, and prevents overlapping connection clicks. After a timeout, close stale wallet requests before explicitly reconnecting. No timeout triggers automatic transaction submission.
