# Wave 1 acceptance record

This file distinguishes implemented paths from externally verified deployments.

| Requirement | Evidence / status |
|---|---|
| Compact compiles, real proving keys | `npm run contract:compile`, Compact 0.31.1 |
| Credential authenticity | Issuer-root membership; tampering/issuer tests |
| Valid credential succeeds | Real local Midnight transaction, `evidence/local-e2e.json` |
| Invalid credential fails | Compiled circuit and real local SDK rejection |
| Replay rejected | Compiled circuit and real local SDK rejection |
| Actual ZK-backed transition | Local proof server + wallet + node + indexer confirmation |
| Public state avoids credential fields | Ledger-shape checks and finalized transaction inspection |
| Holder private storage | Encrypted vault tests; browser issuance/unlock checks |
| Wallet/network interaction | Funded local wallet E2E; browser connector integration provided |
| Frontend | Overview, vault, policy, actual lifecycle, receipt, errors, privacy explanation |
| Tests | Contract, vault, error redaction, state scoping, browser and network E2E scripts |
| Documentation | README, architecture, privacy model, research, demo script |
| Public Preprod deployment | Not performed; requires an operator's funded compatible wallet |
| User-installed wallet extension | Not yet validated; local official adapter tested separately |
| Production security / privacy audit | Not performed; demo assumptions explicitly documented |

The local network is destroyed after E2E. Its transaction IDs cannot be looked up on Preprod explorers. A previous successful evidence file is not evidence that a currently running or public deployment exists.
