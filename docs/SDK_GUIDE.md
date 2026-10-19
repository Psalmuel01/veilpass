# SDK guide

`packages/sdk` is an unpublished, private, source-only TypeScript package named `@veilpass/sdk`. It is used by the workbench/reference HTTP routes and the two-origin harness. Do not run `npm install @veilpass/sdk` expecting a published distribution. Compile `contracts/lifecycle` first. Node 22.22.0+ is required for this repository.

```ts
import { createVeilPassVerifier } from '../packages/sdk/index.js';
import { FileChallengeStore } from '../packages/sdk/file-store.js';

const verifier = createVeilPassVerifier({
  audience: APPLICATION_DOMAIN_HEX,
  networkDomain: NETWORK_DOMAIN_HEX,
  contractAddress: PINNED_CONTRACT_ADDRESS_HEX,
  policyId: 'approved-training', // or professional-level
  store: new FileChallengeStore(PRIVATE_VERIFIER_DIRECTORY),
  chain: authenticatedChainAdapter,
});
const challenge = await verifier.createChallenge(120);
// Deliver challenge to holder; authorize with its exact circuit public inputs.
const result = await verifier.verifyPresentation({
  version: 2,
  challengeId: challenge.id,
  transactionReference: FINALIZED_TRANSACTION_ID,
});
// Authorize one action within your separately authenticated application session.
```

## Trust adapter

`authorization(reference)` must authenticate a successful finalized V2 authorize transaction at the pinned contract/network, authenticate the public request key binding audience/policy/nonce/deadline and bind the accepted status/root snapshot. It must return null for another circuit, failed transaction or unconfirmed result. `currentState()` must query canonical current contract state, including root/domain, active issuer, status flags and validity interval. `observedAt` must reflect actual chain freshness; the live adapter uses the indexed head timestamp rather than a wall clock stamped onto stale data.

The default SDK execution mode is `confirmed-midnight`; the separate `MidnightChainAdapter` accepts real confirmed transactions at an operator-pinned deployment/indexer, pins three circuit verifier keys, binds the typed public request-key insertion and checks canonical status with chain-head freshness. See [live setup and limitations](LIVE_V2.md). The workbench adapter remains explicitly `generated-execution`; default verification rejects it. Never change its mode label to make an unverified result pass.

## Challenge and freshness semantics

Lifetimes are 1–300 seconds, default 120. Challenges and nonces use independent 256-bit randomness. Configured audience, network, contract and policy must match persisted challenge context. SDK checks server time before and after adapter I/O, canonical state age (default 30 seconds, maximum 60), batch expiry, issuer activity and unchanged status/root. Any batch status change rejects old receipts; unaffected holders reauthorize. Revocation observed after the final read can race the action. No claim of immediate token revocation is made.

`FileChallengeStore.consume` creates an exclusive consumed marker, syncs file and directory, and never unconsumes it. Eight concurrent attempts accept only one. Reopening the store retains consumed state. Use an application transaction/shared DB if authorization must be atomic with your business operation or spans hosts; a consumed challenge after a downstream failure requires a fresh challenge, not blind replay. Retain consumed markers at least through all possible acceptance windows. Workbench engine state is intentionally ephemeral and old receipts fail closed after restart.

## Errors

| Code | Meaning / response |
|---|---|
| MALFORMED | Reject incompatible/invalid presentation |
| CHALLENGE / CONTEXT | Unknown or mismatched verifier challenge |
| CHALLENGE_EXPIRED | Ask for a fresh challenge |
| UNCONFIRMED | Wrong mode, contract, missing or unconfirmed authorization |
| BINDING | Transaction context differs from stored request |
| STALE_STATE / INVALID_STATE | Fail closed; investigate canonical adapter |
| EXPIRED / ISSUER_INACTIVE | Deny eligibility |
| STATUS_CHANGED | Obtain new proof-backed authorization against current status |
| REPLAY | Deny; challenge was already consumed |
| TTL / CONFIG / POLICY | Correct verifier configuration |

## Reference applications

`npm run demo:verifiers` opens actual loopback HTTP listeners on 4101/4102, keeps separate verifier stores, verifies one sample credential twice, rejects replay and cross-verifier substitution, then rejects a pre-revocation receipt and new authorizations after revocation. It exits and removes temporary stores. It uses generated Compact constraints, not network proofs. Ports can be changed with `VEILPASS_APP_A_PORT` / `VEILPASS_APP_B_PORT`.

The redesigned browser reference pages `/hackathon` and `/community` use the same SDK but share the workbench origin/cookie. They are sample applications, not independent organizations or an external pilot. Never send raw credentials or holder secrets to the verifier SDK. Eligibility alone establishes neither identity nor a login session.

Live transaction references use the pinned ledger’s version-prefixed 33-byte lowercase hex format. Generated-execution references remain 32-byte lowercase hex. A matching reference format alone does not establish confirmation.
