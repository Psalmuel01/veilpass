# Signed milestone acceptance record

This document separates working local software from public deployment and external acceptance. Use the machine-readable evidence files for actual transaction references and validation counts.

| Capability | Current acceptance |
| --- | --- |
| Holder-owned signing keys | Browser generates and retains signing seed; enrollment sends public context/signature only |
| Signed credentials | Official credential constraints validate issuer signature, schema, claims and explicit holder binding |
| Issuer authorization | Bearer-token operator access with named Postgres role accounts; offers approved for an exact holder key and method |
| Durable authority | Encrypted SQLite locally and encrypted Neon Postgres authority snapshots for hosting; optimistic updates prevent lost concurrent changes |
| Safe issuance retry | Same approved holder can recover the same credential without duplicate records; revoked retries fail |
| Holder recovery | Authenticated encrypted export/import, browser save, signature/ownership restoration, manual/inactivity locking |
| Policy checks | Browser generated constraint checks for both policies, explicitly distinguished from network authorizations |
| V3 ledger | Separately versioned signed authorization, private active-status path, public request window, one-time request set |
| V3 proof artifacts | Full compilation generates authorize/publishStatus/deactivate proving and verifying keys |
| Real local proofs | Confirmed V3 deployment, both policies and revocation recorded in signed-network.json |
| Independent V3 verifier | Pins operation keys/issuer/registry/domain; parses exact canonical transaction insertion; checks fresh current state |
| Durable replay prevention | SQLite and Postgres challenge consumption are atomic across connections and survive restart |
| Browser V3 wallet controls | Actual browser-generated key, issuance, both policy proofs, confirmed verification, network-change rejection and revocation passed; see signed-browser-network.json. Connector bridge, not an installed extension. |
| CI | Workflow configured for Node 24, generated constraints, typechecks, unit tests, production build and browser acceptance; remote run passed for the previous deployment; this change must pass its own CI run |
| Public Preprod | Not deployed; requires Blockfrost project, funded wallet, live compatibility/schema checks and service setup |
| Installed extension | Separate acceptance required; disposable connector bridge does not establish Lace extension acceptance |
| Hosted issuer/verifier | Render Free and Neon deployed; Vercel proxies signed issuance. Real hosted issuance, both local policies and revocation passed; network verification remains gated |
| Operator accounts | Named durable role accounts, token expiry/disablement/rotation and atomic authority audit implemented; institutional legitimacy requires external verification |
| Recovery and rotation | Encrypted authority export/empty-target restore and storage/operator-key rotation implemented; signing-key rollover and lost holder-passphrase recovery remain unsupported |
| Independent review/pilot | Not completed; needs external reviewers and a real issuer/two-application trial |

## Reproduce

Read [SIGNED_ISSUANCE.md](SIGNED_ISSUANCE.md) for local commands, trust boundaries and status publication. Read [PREPROD_SETUP.md](PREPROD_SETUP.md) to obtain external network access and test funds. Actual network tests stop their disposable containers; they never use a real user's wallet seed.
