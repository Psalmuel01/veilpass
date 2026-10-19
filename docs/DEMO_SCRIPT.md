# VeilPass V2 demo script

The narrated, recorded version is described in [VIDEO_DEMO.md](VIDEO_DEMO.md). Its editable script is `scripts/video-v2/story.mjs`.

1. **Problem:** Developers need to prove qualifications without handing every application a complete credential. Show the redesigned landing page.
2. **One qualification, two policies:** Show `/lifecycle`, initialize the sample, and explain hackathon entry and professional community access. Explicitly label this workspace as generated constraint execution.
3. **Privacy boundary:** The verifier receives eligibility, a policy and a one-time reference. The holder-controlled local prover receives the private witness; the verification API does not receive the holder secret.
4. **Real local authorization:** Run `npm run demo:live`. This builds and launches `/live` against a disposable real Midnight network with a funded connector-bridge test wallet. It is not an installed extension or Preprod deployment.
5. **Hackathon:** Request a fresh challenge, generate and submit a real proof, wait for confirmation, then verify. Show the independent SDK's `confirmed-midnight` result. A second verification with the same challenge fails replay protection.
6. **Community:** Choose professional-level policy and repeat using the same qualification. Show a second confirmed authorization with a separate audience and fresh challenge.
7. **Revoke:** The automated lifecycle recording uses the integration harness to submit a real administrator-authorized revocation. Show its actual transaction reference, then reject the old receipt against current canonical status. A fresh proof attempt fails with `Credential is revoked`.
8. **Developer integration:** Show `/developers` and `docs/SDK_GUIDE.md`. The repository provides typed challenges, an independent chain adapter, durable challenge storage and integration guidance. The SDK is not published.
9. **Close:** State that this is a validated local prototype. Signed issuance, holder-owned binding, installed-wallet acceptance, scalable issuance, Preprod deployment and an external pilot remain future work.

For automated recording of the complete revocation sequence, follow `docs/VIDEO_DEMO.md`; the interactive demo does not automatically advance through the recorded script. Keep actual run evidence separate from generated-execution examples, and do not present local wait times as benchmarks.
