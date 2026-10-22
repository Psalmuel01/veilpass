# VeilPass deployment and acceptance report

Verified 22 October 2026. This report distinguishes confirmed protocol execution from remaining release work.

## Deployed services

- Website: https://useveilpass.vercel.app
- API: https://veilpass-preprod.onrender.com
- Database: Neon Free, encrypted issuer records and durable challenge consumption.
- Repository: https://github.com/Psalmuel01/veilpass
- Explorer: https://preprod.midnightexplorer.com — search the contract or transaction references below.

Vercel serves the interface; Render serves the persistent API and restricted indexer gateway. They complement each other. Localhost is used only for controlled development and operator validation. GitHub pushes update application deployments; changing a Compact contract requires a separate confirmed transaction. Render Free can sleep and has no persistent high-memory prover. Do not advertise an always-available hosted proving service.

## Confirmed Preprod evidence

Contract: `5120e2bc49267ad91653edb9806a010da0bb0428d78acd9dbf0e994a058cd24a`.
Deployment transaction: `00a287e83877045c6dc9573848e203e6e34f380ff87e1519f1905e015b571c9d49`, block 3085824.

| Action | Confirmed transaction reference |
| --- | --- |
| Publish active credential status | `00f4eb717cc8253da36cf9f20732c10665908789a32c6613affce243df73cb16b3` |
| Hackathon policy authorization | `00735a74eb4ccfb3fb5f69f2c22f713c250381b75b76c8f0bec04d3165ce7cdd03` |
| Community policy authorization | `00adc00579297f5dc0e5191c462c6d218688e1e12e5f498d8033819ff6249c3739` |
| Publish revoked status | `00a40be841c996903e5a59cfa0406d6e2f53fafe602fde0c18afd1c802e0e89cdd` |

All four were reconciled against canonical Preprod data. Both policies verified and their challenges were consumed durably in Neon. Replay was rejected. The encrypted synthetic holder backup was restored, and a fresh revoked authorization failed the actual deployed-contract call pipeline's active-membership constraint before submission. No invalid transaction was sent. The old receipt was already expired; status change was independently established, rather than attributing its rejection exclusively to revocation.

Machine-readable evidence: [authorization](evidence/preprod-authorization.json), [release pins](evidence/preprod-release.json), [deployment](evidence/preprod-terminal.json), [gateway](evidence/preprod-gateway.json). These are recorded results, not a newly executed proof whenever a page loads.

## Validation in this revision

- Root suite: 91 tests passed across 20 files.
- Signed issuance module: 39 tests passed; module type checking passed.
- Root and website type checking passed.
- Production build passed, including the new read-only evidence page and API.
- Public Vercel and Render verifier assets returned HTTP 200 and matched the pinned SHA.
- Status publisher checked live hosted state against Preprod and correctly skipped a redundant transaction.
- Fresh local-network replay was attempted, but Docker became unavailable before startup. It is not reported as a new pass. Existing real local-network and browser evidence remains separately dated in `evidence/signed-network.json` and `evidence/signed-browser-network.json`.

The compatible deployment uses Compact 0.31.1, runtime 0.16.0, ledger 8.1.0, Midnight.js 4.1.1 and Preprod prover 8.1.3. The terminal wallet SDK remains a tested 1.1.0 exception to the newer official wallet umbrella release; its fee balancing extension and confirmation polling are covered by tests. Do not upgrade individual WASM dependencies independently.

## Release boundaries

This is a verified Preprod prototype. `productionReady` is false and public browser proof activation remains disabled. Terminal acceptance does not establish installed Lace compatibility or hosted browser proving.

Still required before handling real credentials: installed-wallet connection/decline/disconnect tests, a persistent appropriately sized trusted prover, fresh-browser hosted proof acceptance, independent security review, issuer governance and operational rotation exercises, and an external pilot with one issuer and two independent applications. Pilot invitations and guides can be prepared internally; participant results cannot be fabricated.

The issuer knows the credential claims. Public transaction timing and wallet activity remain visible. Status publication requires an authorized chain transaction. Changing the status root invalidates older receipts, including receipts for unaffected credentials; applications need fresh verification. Revocation does not terminate sessions already created by an external application. Forgotten vault passphrases cannot be reset by the service.

## How to confirm

Use the explorer search with the public references above. Run the independent release command from `PREPROD_TERMINAL.md` using the ignored operator environment. Review the JSON evidence alongside the pinned source and verifier hashes. Never share `.private`, wallet seeds, database URLs or Blockfrost tokens.

For new network acceptance, use the operator guide and a fresh synthetic credential. Do not rerun a guarded submission merely because the browser or node notification timed out: reconcile its recorded transaction reference first. Application rollback does not undo chain state or revocation.
