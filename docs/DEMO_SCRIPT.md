# Demo script

Start: “VeilPass lets developers prove qualifications without handing every application an entire credential. Today I will distinguish a real legacy proof-backed flow from the new lifecycle constraint/SDK implementation.”

1. Run the documented build/test commands. Start `VEILPASS_WORKBENCH=1 npm run dev`, open `/lifecycle` and point out the generated-execution label and server-known sample witnesses.
2. Initialize the sample academy batch. Explain pinned-root authenticity, shared batch validity and current bearer-credential limitations.
3. Choose hackathon policy, request a challenge, evaluate Compact constraints, verify with SDK. Show the minimal result, policy, reference and mode. Do not describe generated constraint execution as a ZK proof.
4. Click verify again: durable replay rejection. Change to community policy and repeat with the same qualification. No holder-derived global identifier is returned.
5. Select the level 1 comparison credential under community policy: “Qualification level too low.” Unselect it, request/evaluate again, but revoke before SDK verification: old authorization must fail status comparison.
6. Visit `/hackathon` and `/community` after revocation and retry: both fail a fresh request. Explain that the browser pages share one development origin.
7. Run `npm run demo:verifiers` to show actual independent HTTP origins, separate challenge stores and the same lifecycle checks. Explicitly retain the generated-execution qualification.
8. Open `/developers` and `docs/SDK_GUIDE.md`; show that default SDK mode refuses generated results and requires an authenticated finalized-chain adapter.
9. If Docker and proof artifacts are available, run `npm run test:lifecycle:e2e`; show newly recorded real transaction evidence only if it succeeds. Otherwise state the exact Docker/key-generation blocker. `/wallet` retains the older real wallet/prover workflow and historical local evidence, not a live V2 deployment.

Close: state missing official VC signatures, holder-owned binding, scalable issuance, Preprod adapter/deployment and external pilot. No fabricated partnership, live contract address or benchmark.

The public introduction is now at `/`, with app entry into `/lifecycle`. Proof keys have been generated successfully; use the artifact manifest to demonstrate that milestone separately from real proof/deployment evidence.
