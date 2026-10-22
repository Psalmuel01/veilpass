# Current signed V3 scope

The deployed signed V3 flow uses holder-generated keys, issuer signatures, encrypted vault recovery, private eligibility and active-status membership. The issuer knows claims; transaction timing and wallet metadata remain public. A trusted prover can observe supplied private witnesses. Browser compromise can expose an unlocked vault. Status changes require confirmed publication and invalidate older receipts. See [current deployment boundaries](FINAL_DEPLOYMENT_REPORT.md). The material below describes the earlier protocol and must be read in that historical scope.

# Threat model

Scope: trusted verifier pins the genuine contract and domain; cryptographic/runtime assumptions hold. Workbench is local developer execution with server-known witnesses. No production security audit has been performed.

| Threat | Control / executable evidence | Residual risk |
|---|---|---|
| Malicious issuer | Immutable approved issuer and root; tamper/issuer constraint tests | Issuer can certify false facts; governance is external |
| Forged issuer signature | No signature scheme used; authenticity is committed batch membership | Signed VC requirement outstanding; never advertise a signature check |
| Compromised issuer/admin key | Deactivation; administrator hash-preimage constraints | No key rotation or recovery; stolen administrator can revoke/deactivate |
| Stolen or copied credential | Secret participates in commitment; altered secret fails | Bearer copies work; no device/non-transferable binding |
| Revoked credential | Private choice of public status bits; tests reject both audiences | Tiny batch, public revocation metadata |
| Expired/future credential | Ledger block-time and shared validity constraints; boundary tests | Local generated execution trusts supplied time; no network test yet |
| Replayed proof/action | Request set plus durable exclusive verifier consumption; concurrent SDK tests | No application session/token implementation |
| Wrong verifier/policy/domain | Constructor-pinned pairs, canonical request hash, stored challenge context | Misconfigured/verifier-controlled trust anchors remain dangerous |
| Manipulated frontend | Circuit checks authenticity/predicate/status; SDK independently verifies context | Compromised frontend steals unlocked secrets |
| Stale indexer | Adapter current canonical state contract, observation-age bound, stale tests | Honest adapter required; bounded observation race remains |
| Public metadata correlation | No holder-derived V2 request hash; read both status bits | Wallets, batch size, timing and issuer knowledge still correlate |
| Weak entropy | crypto randomBytes / getRandomValues, 256-bit challenges and secrets | Host/browser entropy and passphrase quality trusted |
| Serialization/malleability | Generated Compact persistent hashes, domain-separated struct; canonical lowercase hex, bounded UTF-8 without NUL | No signature malleability claim because signatures absent |
| Unsupported disclosure | Whitelisted SDK response, error redaction, privacy shape tests | No formal leakage proof or V2 transaction inspection |
| Unauthorized administrator | Private admin preimage witness; revoke/deactivate negative tests | Local engine deliberately has sample admin authority |
| Revocation rollback | No root update or unrevoke/reactivate circuit; monotonic public flags | New deployment requires verifier repinning; no generic registry |
| Revocation races / old proof | State-dependent circuit transcript; SDK rejects changed status version | A status change immediately after last canonical read can precede action; no instant guarantees |
| Proof service exposure | Existing loopback-only provider; document local trust | Malware/local service compromise can steal witnesses |
| Private-state loss | Encrypted local legacy vault; errors fail closed | No backup/recovery; device/passphrase loss loses access |
| Challenge-store crash/concurrency | Exclusive file creation, file+directory sync; eight-way consumption test and reopened store | Single filesystem only, no multi-host DB; prune records operationally |
| Workbench API misuse | Disabled by default, same-origin loopback, HttpOnly cookie, per-session limits | All workbench actors are developer-controlled; not production authorization |
| Resource exhaustion | Workbench request size/session/request bounds | Streaming body limit enforced; no public hosting authorization for workbench |
| Dependency compromise | Exact lockfile, checksummed compiler, no install-time upgrades | npm installation reported advisories; release dependency review remains required |
