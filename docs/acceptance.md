# Wave 1 acceptance

What's verified, and what isn't.

## Verified

| Requirement | Evidence |
|---|---|
| Compact compiles with real proving keys | `npm run contract:compile`, Compact 0.31.1 |
| Credential authenticity | Issuer-root membership; tampering and issuer tests |
| Valid credential succeeds | Local Midnight transaction, `evidence/local-e2e.json` |
| Invalid credential fails | Compiled circuit, rejected through the SDK |
| Replay rejected | Compiled circuit, rejected through the SDK |
| ZK-backed state transition | Local prover, wallet, node and indexer confirmation |
| Public state excludes credential fields | Ledger-shape checks and finalized transaction inspection |
| Holder private storage | Vault tests, browser issuance and unlock checks |
| Wallet and network interaction | Funded local wallet E2E via the official connector |
| Frontend | Overview, vault, policy, lifecycle, receipt, errors |
| Tests | Contract, vault, error redaction, state scoping, browser and network E2E |
| Documentation | README, architecture, privacy model, research, demo |

## Not done

| Item | Why |
|---|---|
| Public Preprod deployment | Needs an operator's funded wallet |
| User-installed wallet extension | Only the local adapter has been exercised |
| Production security or privacy audit | Out of scope; assumptions are documented instead |

The local network is destroyed after each E2E run, so its transaction IDs don't resolve on a Preprod explorer. An evidence file from a past run doesn't mean a deployment is currently live.
