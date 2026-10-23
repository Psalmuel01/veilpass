# Remaining release gates

## Completed engineering in this revision

- Shared backend/browser trust policy for loopback and explicitly pinned HTTPS proving.
- Exact-origin holder consent checked before private presentation construction or provider requests.
- Consent reset for each attempt; rejection of unsafe URL shapes, unpinned destinations and protocol downgrades.
- Existing release gate and default loopback behavior preserved.

This is configuration support, not a deployed remote prover or a new successful proof run.

## Cannot complete autonomously under the current constraints

1. **Suitable persistent prover.** There is no provisioned trusted endpoint. The $0 Render service cannot run the recorded V3 workload within its memory allowance. A user-controlled machine or separately approved suitable hosting is required. No paid service or external witness transfer has been authorized/provisioned by this change.
2. **Installed-wallet acceptance.** Real Lace unlocking, any new credentials and required wallet approvals need the wallet owner. Mocked wallet tests and terminal transactions cannot establish this acceptance.
3. **Institutional onboarding.** Issuer roles and authorization do not establish the legitimacy of an organization or the truth of qualifications. An accountable issuer must participate.
4. **Independent security review.** Automated tests and implementation review are useful but cannot be presented as an independent external audit.
5. **External pilot.** One real issuer and two independently operated applications must participate and provide measured results. Prepared invitations and guides already exist in `PILOT_GUIDE.md`; no invitations have been sent.

After resources and wallet access are available, validate the fresh-browser holder → issuance → two proof-backed policies → replay rejection → backup recovery → published revocation journey, test failure conditions, then activate the checked-in public release gate. Keep `productionReady: false` and network activation off until the required acceptance evidence exists.
