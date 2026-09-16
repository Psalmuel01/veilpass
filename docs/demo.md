# Demo walkthrough

Runs 2–4 minutes.

## Before recording

Run the README setup and tests, and keep Docker up. Check the proof server responds on the configured loopback URL. For a public walkthrough, fund a Preprod wallet, connect it, deploy the batch once and save the address.

Never describe a local test transaction as a Preprod one.

To rehearse the whole thing automatically:

```bash
VEILPASS_BROWSER_E2E=1 npm run test:e2e
```

That drives a real funded local wallet through the official connector adapter — nothing is mocked. Screenshots of the confirmed and rejected states land in `docs/screenshots`. The chain is disposable, so a fresh environment can repeat it without a faucet.

## Interactive local recording

`npm run demo:local` opens a Chrome window connected to a fresh local chain and funded development wallet. Select **Funded local test wallet** when prompted. This wallet automatically approves local transactions; it is not your browser extension or a mainnet account. Keep the visible network label in the recording. Closing Chrome shuts down the disposable network.

## Script

**0:00 — Problem.** Open the overview. "An application needs to know whether I qualify, not collect my whole academic record."

**0:25 — Credential.** Under My credential, pick the eligible sample, set a vault passphrase, and get the credential. Show the fields briefly. Point out that the issuer knows this sample but the verifier never receives the JSON. Hide them again.

**0:55 — Requirement.** Open Verify eligibility. Show the policy: approved university AND graduation year ≥ 2020. Walk the disclosure list — the public nullifier, the private local prover.

**1:20 — Proof.** Connect the wallet and generate. The stages are real SDK, prover, wallet and network events, so approve the prompt when it appears. Proving is slow on a modest machine; don't swap it for a timer.

**2:00 — Result.** Eligibility Verified, with the real transaction ID, block and network. On Preprod, open the explorer link. Note that public state holds the root and nullifier, not credential fields.

**2:30 — Negative case.** Back to My credential, switch to the ineligible sample, prove again. The circuit rejects it. Eligibility Not Verified, and no receipt.

**3:00 — Vision.** "This is one fixed policy and two shared demo credentials. The same primitive extends to richer authorization." Don't imply production identity verification, revocation, a large anonymity set, or a deployment that hasn't happened.

## Repeating it

Each sample authorizes once per application scope — reusing a valid sample is a replay and should fail. `test:e2e` gets a fresh chain each run. For an independent public demo, create a new batch in a separate checkout; don't overwrite the private file of a batch you've already deployed.
