# VeilPass Preprod pilot

The pilot starts only after the recorded Preprod contract passes deployment and authorization acceptance. The current hosted credential journey alone does not satisfy this gate. Use synthetic qualifications until an independent security review is complete.

## Invitation to share

We’re testing VeilPass, a privacy-preserving credential system built for Midnight. We need one training organization to issue test credentials and two independently operated applications to verify eligibility. The pilot uses Midnight Preprod test tokens and synthetic records; no real identity documents, student records or payments are required. Participants will test issuance, two eligibility policies, revocation and encrypted backup recovery, and report aggregate success rates and timing. Participation is voluntary. Would your team be willing to take part in a supervised test session?

## Participants and setup

Record the issuing organization and responsible contact privately. Each application team chooses its own verifier audience and runs its own verifier; two tabs of our demo are not two independent applications. Agree the test window, consent, who can approve/revoke, and who handles recovery. Do not collect wallet seeds or record passwords. Give each participant a separate synthetic holder and least-privilege operator access where required.

## Acceptance session

1. From a fresh browser, create the holder wallet, save an encrypted backup and receive a holder-bound credential from the authenticated issuer.
2. Connect installed Lace on Preprod. Decline the first connection or transaction approval and confirm the app recovers without issuing a success receipt.
3. Reconnect and authorize the approved-training policy. Record the public contract/transaction reference, duration, and independent verifier result.
4. Authorize professional-level in the second application with its distinct audience. Reject a receipt copied from the first application and reject a second use of each consumed request.
5. Disconnect during preparation, test a network mismatch, and let a challenge expire. Confirm bounded errors. After an uncertain submission, reconcile its transaction reference before requesting another authorization.
6. Restore the encrypted backup in a fresh browser. Confirm the same holder can use a newly issued challenge. A wrong passphrase must fail.
7. Revoke the credential, publish the updated registry status on Preprod and wait for indexed confirmation. Confirm both applications reject the old authorization and a new attempt. A database-only revocation is insufficient evidence for this step.
8. Repeat the supported journey in mobile Safari and Android Chrome with their actual wallet support recorded. Mark unavailable integrations unsupported rather than passed.

## Measurements

Use `pilot-measurements.csv`. Record durations and public transaction references only. Do not log private claims, credentials, enrollment offers, proof witnesses, passwords or operator tokens. Report attempts and failures as well as successes. Keep real participant identities in a separate private record.

A pilot passes only when both independently hosted applications have confirmed authorizations, cross-application/replay rejection, and rejection after on-chain revocation; recovery must succeed in a fresh browser. Record actual limitations and remediation. Only then record the final Preprod demo.

## Independent review brief

Ask a reviewer who did not implement the system to assess issuer/holder key ownership, circuit signature constraints, status-tree membership and revocation freshness, transcript extraction, verifier-key pinning, audience/replay binding, API authorization, rate limits, storage encryption/recovery, endpoint proxy restrictions and wallet retry behavior. Provide source commit, generated artifact hashes and test evidence; provide synthetic data only. Track each finding, severity, fix commit and reviewer retest. This brief is not an independent security review.
