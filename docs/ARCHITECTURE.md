# VeilPass V2 architecture

VeilPass targets developer/professional eligibility. Two implementations coexist; they must not be conflated.

| Component | Implemented behavior | Evidence boundary |
|---|---|---|
| `contracts/veilpass` + `/wallet` | Legacy graduation proof, immutable issuer batch, scoped nullifier | Historical local network evidence; existing wallet/prover adapter |
| `contracts/lifecycle` | V2 batch authentication, trusted ledger-time window, two policies, one-shot request, issuer authorization, irreversible revocation/deactivation | Generated constraints plus a passing real local-network lifecycle; see evidence/lifecycle-network.json |
| `packages/lifecycle` | Strict parsing, canonical encodings, witnesses, sample fixtures | Generated bindings, security tests |
| `packages/sdk` | Challenge creation, context verification, current-status comparison, atomic durable consumption | Compiled-circuit integration tests; default confirmed mode fails closed |
| `/live` + `/api/live` | Browser-owned witness memory, real wallet/local prover, independent pinned indexer verification | Real Chrome/local-chain evidence; trusted canonical indexer and compiler-specific typed parser |
| `/lifecycle`, `/hackathon`, `/community` | Local developer workbench and two reference pages using SDK | Generated execution; same-origin server knows samples |
| `scripts/two-verifiers.ts` | Two independent HTTP listeners/stores and challenge domains | Generated execution, not independent organizations |
| `scripts/lifecycle-e2e.ts` | Deploy/prove/revoke on Docker Midnight network | Passed: real local deploy, two proof-backed policies, replay, confirmed revocation and fresh rejection |

## Contract model

V2 deliberately bounds the issuer batch to two credentials. Constructor-pinned issuer, root, administrator commitment, domain, audiences and shared batch validity are the trust anchor. There is no self-registration, root mutation, key rotation or generic policy editor. A new batch requires deployment. The administrator proves a domain-separated hash preimage in a private witness. Revocation sets either public bit to true; no circuit clears a bit. Issuer deactivation is permanent. Read both revocation bits before privately choosing the relevant one; do not disclose leaf position during authorization.

All Qualification fields bind to a generated persistent hash, itself domain separated. Merkle root construction uses a separate tag. The circuit requires approved program, completion, level 1 for the hackathon or level 2 for the professional community. Audience/policy pairs are pinned at deployment. Issuance and expiry must match the shared batch window, avoiding unique timestamps in authorization outputs. Runtime block-time constraints are enforced at ledger execution; local generated execution uses the test host's supplied context time.

A request hash commits a fixed Compact struct: tag, network domain, audience, policy, nonce and deadline. It contains no holder secret or credential commitment. Consuming it prevents transaction reuse of the exact request. Verifiers accept only their own durable, short-lived challenges, then atomically consume the challenge before returning success. Eligibility is not session authentication.

## Status freshness

A new authorization reads current revocation/issuer state. V2 SDK compares the historical authorization's batch status version and root with current adapter state. Any status change invalidates every pre-change authorization conservatively, including unaffected holders, who must generate a new authorization. The SDK enforces server time, challenge expiry and a bounded state-observation age (30 seconds default, at most 60). The adapter must actually query canonical state; adding a current timestamp to cached data violates its contract. This is observation-time validity, not a claim of instantaneous revocation or token invalidation.

## Storage and failure behavior

Legacy plaintext is session-only in the browser, encrypted at rest in its existing vault. V2 sample witnesses are held in local server memory; the workbench is explicitly not a privacy proof. Workbench HTTP access requires opt-in environment configuration, same-origin loopback requests, an HttpOnly SameSite cookie, bounded sessions and per-session rate limiting. Session/ledger/receipt state is not durable, and restarting fails closed because old authorizations disappear. Challenge and consumption files use owner-only modes, exclusive creation and fsync; use a transactional shared datastore for multi-host deployments.

## Official credentials migration

The current lifecycle uses issuer-pinned membership, **not signatures or standards-compliant VCs**. No cryptographic signature implementation was invented. Integrating official `credential-compact` verification, holder-owned keys and scalable issuer/status infrastructure remains required. See `MIDNIGHT_COMPATIBILITY.md`. DID resolution is optional, not an MVP trust anchor.

The separate [local signed-issuance foundation](../integrations/issuance/README.md), added on 20 October 2026, now exercises the official credential signature checks and holder-owned keys under Node 24. It uses generated Compact constraints and ephemeral local status/request stores. It does not change the current V2 ledger contract or verifier adapter; the proof-backed migration remains a separate integration gate.

## Public site and workspace rebuild

The public site now occupies `/`; the existing proof-backed wallet workflow moved intact to `/wallet`. Shared brand, site navigation and responsive workspace components live under `apps/web/components`. The lifecycle, developer and reference pages use the rebuilt visual system. See `UI_REDESIGN.md`. Full V2 proving/verification keys have been generated; this does not change the sandbox execution mode.

## Live V2 path

`/live` keeps an imported qualification in browser memory and uses `lifecycle-midnight.ts` for real wallet/prover/transaction operations. `/api/live` only receives policy/challenge/presentation context; operator configuration pins deployment, network, root, endpoints and local verifier artifacts. `MidnightChainAdapter` binds a successful indexed transaction to its exact typed consumed-key insertion and checks current canonical root/status/head freshness. See [LIVE_V2.md](LIVE_V2.md) for the compiler-specific parsing boundary, trusted indexer model and reproduction commands. The generated workbench and reference pages remain separate.
