# Demo walkthrough (2–4 minutes)

## Before recording

Run the README setup and tests. Keep Docker running. For a public-wallet walkthrough, fund a Preprod wallet, connect it, deploy the issuer batch once and save the address. Never describe a local test as a Preprod transaction. Check the proof server is reachable at the configured loopback URL.

For an automated real local demonstration, run:

```bash
VEILPASS_BROWSER_E2E=1 npm run test:e2e
```

It uses a real funded local wallet through the official connector adapter. No proof or confirmation is mocked. Screenshots of confirmed and rejected UI states are written to `docs/screenshots`. The chain is ephemeral and removed afterward. A fresh environment can repeat this without a faucet.

## Script

**0:00 — Problem.** Show the overview. “An application needs to know whether I qualify, not collect my whole academic record.”

**0:25 — Credential.** Choose My credential, select the eligible sample, enter a vault passphrase and get the demo credential. Reveal the fields briefly. Explain that the issuer knows the sample, but the verifier does not receive the credential JSON. Hide the fields again.

**0:55 — Requirement.** Open Verify eligibility. Show approved university AND graduation year ≥ 2020. Review the disclosure list. Mention the public application nullifier and private local prover.

**1:20 — Proof.** Connect the wallet and generate the proof. The stages are actual SDK/prover/wallet/network events. Approve the wallet prompt. Proof generation may take longer on a slow machine; do not replace it with a timer.

**2:00 — Result.** Show Eligibility Verified, actual transaction ID, block and network. For a Preprod deployment use the explorer link. Explain that public state contains the batch root and authorization nullifier, not the credential fields.

**2:30 — Negative case.** Return to My credential, replace with the ineligible sample, then prove. The circuit rejects the credential. Show Eligibility Not Verified; no successful receipt is created.

**3:00 — Vision and limits.** “This is one fixed policy and two shared demo credentials. The same private-computation primitive can support richer authorization policies later.” Do not imply production identity verification, revocation, a large anonymity set, or a public deployment that has not occurred.

## Repeating the demo

Each sample may authorize once per application scope. A second use of the same valid sample is a replay and should fail. The local E2E command creates a fresh chain. For an independent public demo, create a new issuer batch in a separate checkout and deploy it; do not overwrite an existing deployed batch's private file.
