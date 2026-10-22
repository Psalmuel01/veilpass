# What works, how to test it, and what comes next

Updated 22 October 2026. The public website uses Vercel, a Render Free API and Neon persistence. V3 is deployed and independently verified on Midnight Preprod; actual two-policy authorization and replay checks have passed, with final revocation-proof acceptance and public activation still under validation. See [hosted Preprod setup](HOSTED_PREPROD.md) and [partial network evidence](evidence/preprod-authorization-partial.json). The V2 browser sandbox uses generated Compact execution; it does not generate a ZK proof or submit a V2 transaction.

The separate `/live` page now provides real browser proving, submission, confirmation and chain-backed SDK verification against a configured deployment. See [live V2 setup](LIVE_V2.md); the ordinary preview reports unconfigured until a live deployment is supplied.


The new signed flow is documented in [SIGNED_ISSUANCE.md](SIGNED_ISSUANCE.md): browser holder keys and encrypted recovery, authenticated holder-bound issuance, encrypted durable issuer state, a separate V3 proof-backed contract and verifier, and local-network evidence. Use Node 24.22.0 and the root npm workspace. Public Preprod setup is in [PREPROD_SETUP.md](PREPROD_SETUP.md). Earlier V2 sample sections below describe their separate behavior.

## Working features

| Feature | Available now | How to exercise it |
|---|---|---|
| Public website | Product workflow, privacy explanation, FAQ, app links | Open `/`; follow navigation and expand FAQs |
| Appearance | Self-hosted Space Grotesk, light/dark mode across all six pages, system default, saved preference, cross-tab synchronization | Use the sun/moon button; reload and move between pages |
| Responsive navigation | Public mobile navigation; workspace drawer with keyboard focus containment and Escape dismissal | Use a narrow window; open workspace navigation and press Tab/Escape |
| Sample qualification | Two bounded authentic training records, initialized per browser session | `/lifecycle` → Initialize sample lifecycle |
| Two eligibility policies | Hackathon requires level 1; community requires level 2; both require approved issuer/program and completion | Select each policy and run the three verification steps |
| Challenge/receipt flow | Fresh audience/policy/domain-bound challenge, generated constraint evaluation, SDK verification, inspect/copy minimal receipt | Request → Evaluate → Verify; expand receipt |
| Replay protection | One-time challenge consumption; durable atomic SDK store in standalone integration | Press Verify again; expect “Challenge already consumed” |
| Negative qualification | A level 1 record cannot satisfy community policy | Community → Try a different qualification → Test level 1 credential → fresh request/evaluation |
| Issuer controls | Admin-authenticated irreversible credential revocation and issuer deactivation | Expand Manage sample qualification; revoke, or deactivate in a fresh session |
| Reference applications | Hackathon and community sample acceptance via shared sample session and SDK | Initialize first, then visit `/hackathon` and `/community`, check qualification |
| Revocation propagation | Fresh requests in either reference app fail after revocation; SDK invalidates receipts predating status changes | Revoke in workspace, then check both apps again |
| Session activity | Visible local history of sample operations | Inspect the workspace activity panel |
| Developer portal | Integration example, policies, receipt/privacy/security documentation | `/developers` |
| Legacy encrypted wallet | Sample university credential, encrypted local persistence, lock/unlock and reveal/hide | `/wallet`; issue sample with a passphrase of at least 12 characters, lock/reload/unlock |
| Legacy Midnight integration | Connector v4 discovery, network checks, local proving, wallet balancing, submission, confirmation/receipt | Requires wallet, prover, valid contract and network configuration; see LEGACY_README.md |
| V2 Compact contract | Authenticity via pinned two-leaf batch; validity constrained by ledger time; approved policy/audience/network; replay state; private leaf selection; revoke/deactivate | `npm test`; actual network reproduction below |
| Proving artifacts | Real proving and verification keys for authorize, revoke and deactivate | `npm run lifecycle:compile`; inspect evidence/lifecycle-artifacts.json |
| Live V2 browser | In-memory qualification import, connector wallet, local prover, real submission/confirmation and SDK chain verification | `npm run demo:live` or `npm run test:live:browser`; both policies, replay and real revocation passed |
| Real local V2 network lifecycle | Confirmed deployment, two proof-backed policy authorizations, replay rejection, confirmed revocation, fresh rejection under both policies | `npm run test:lifecycle:e2e`; recorded evidence/lifecycle-network.json |
| Verifier SDK | Typed short-lived challenges, strict context binding, current-state/expiry checks, conservative status invalidation, atomic durable replay consumption | `npm test` and `npm run demo:verifiers` |
| Two-origin integration | Actual HTTP verifiers on ports 4101/4102, independent durable stores, reuse/negative/revocation scenarios | `npm run demo:verifiers`; generated execution, not proofs |

## Five-minute browser walkthrough

1. Open `http://127.0.0.1:3003/` for the running preview. Use the sun/moon control, reload, and follow Open app. Your choice should persist.
2. Initialize the sample lifecycle. Select Hackathon entry. Press Request a fresh challenge, Evaluate Compact constraints, then Verify with SDK. Expect **Eligible**. Inspect the receipt.
3. Press Verify again. Expect **Challenge already consumed**. Each new attempt needs a fresh challenge.
4. Select Community access and complete the three steps again. Expect **Eligible**. With Test level 1 credential enabled, a fresh request/evaluation should fail with **Qualification level too low**. Disable that option afterward.
5. Before revocation, open `/hackathon` and `/community` in the same browser session and check the sample qualification. Both should accept the initialized level 2 sample.
6. Return to `/lifecycle`, expand Manage sample qualification, and revoke. Repeat checks in both reference apps. Expect **Credential is revoked**. Revocation is irreversible in that sample session.
7. For deactivation, use a fresh browser profile/incognito session, initialize again, then deactivate the issuer. Fresh authorization should fail. Sample state expires after one hour or server restart; this is not a production account system.
8. Open `/wallet`. Issue the sample credential using a passphrase of at least 12 characters. Lock, try a wrong passphrase, then unlock with the correct one. Reveal/hide details. Connecting a real wallet and generating a proof requires the additional configuration below.
9. At a 360px-wide window, repeat navigation and theme switching. Workspace navigation should support Tab and Escape without horizontal page overflow.

Only use sample data in the V2 workbench: its server knows the witnesses. The legacy vault encrypts browser storage; witnesses are readable while unlocked and by a local prover.

## Automated checks and local startup

Use Node 24.22.0, installed dependencies and the pinned Compact toolchain.

```sh
nvm use
npm ci
npm run toolchain:install     # first setup only
npm run contract:check
npm run lifecycle:check
npm test
npm run typecheck
npm run demo:verifiers

# Production preview (keep this terminal running):
VEILPASS_BUILD_DIR=.next-theme-build npm run build
VEILPASS_WORKBENCH=1 VEILPASS_BUILD_DIR=.next-theme-build npm run start -- --port 3003

# Another terminal, with Chrome installed:
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 npm run test:theme:ui
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 npm run test:v2:ui
VEILPASS_UI_ORIGIN=http://127.0.0.1:3003 npm run test:ui
```

The workbench is explicitly opted in, restricted to same-origin loopback requests and isolated by an HttpOnly session cookie. Run the suites sequentially. Each creates its own browser session. The standalone two-verifier harness needs free ports 4101/4102.

For real network proofs, start Docker Desktop, allow sufficient disk/memory and image-download time, then run:

```sh
npm run lifecycle:compile
npm run test:lifecycle:e2e
```

The harness creates a funded disposable local wallet, node, indexer and prover; it disposes the chain afterward. Transaction IDs in the recorded evidence describe that completed local run, not a live deployment or Preprod. If Docker's desktop credential helper blocks public image pulls, see the isolated Docker configuration in DEPLOYMENT.md. The original wallet network setup is documented separately in LEGACY_README.md.

## Remaining work, in recommended order

1. **Expand real-wallet acceptance and review.** The live browser and chain adapter are implemented. Validate installed wallet extensions, declined approvals, disconnect/slow-prover recovery, independent transcript-parser review and deployment operations. The tested local wallet is a funded connector bridge.
2. **Establish real issuance and holder control.** Integrate compatible official credential signing/verification libraries, define holder-owned keys and recovery, authenticated issuer administration and key rotation. Today authenticity is a fixed issuer-pinned Merkle batch, and the sample issuer knows bearer secrets.
3. **Expand the bounded protocol deliberately.** Replace the two-record development batch with an authenticated scalable issuance/status model, select supported policy configuration, and assess privacy leakage at realistic anonymity-set sizes.
4. **Deploy and validate on Preprod.** Provision a funded operator wallet, persistent services and safe configuration; confirm both real application flows with the same holder credential and after revocation. Add wallet disconnect, declined approval, slow prover, stale indexer and retry coverage.
5. **Harden the service for external use.** Replace in-process sample sessions with authenticated durable storage, production challenge storage/operations, monitoring, deployment controls and security review. Separate issuer, holder and verifier trust boundaries.
6. **Run a real pilot and finish submission evidence.** Recruit an actual training issuer and two applications; measure onboarding, proof latency, success/failure and revocation behavior. Record a demo, update the submission and confirm organizer rules/dates. No external adoption or pilot results are claimed yet.

The SDK is private repository source, not a published npm package. Eligibility verification does not by itself implement login, identity verification, or revocable access sessions. No generic policy builder, general issuer registry, public V2 deployment or signed VC product is complete.
