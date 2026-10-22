# Current signed V3 scope

The deployed signed V3 flow uses holder-generated keys, issuer signatures, encrypted vault recovery, private eligibility and active-status membership. The issuer knows claims; transaction timing and wallet metadata remain public. A trusted prover can observe supplied private witnesses. Browser compromise can expose an unlocked vault. Status changes require confirmed publication and invalidate older receipts. See [current deployment boundaries](FINAL_DEPLOYMENT_REPORT.md). The material below describes the earlier protocol and must be read in that historical scope.

# Privacy model

## Field classification

| Field | V2 intended proof boundary | Workbench / metadata |
|---|---|---|
| Holder secret | Private witness, committed in credential | Issuer and local workbench server know it; not returned by SDK |
| Program, level, completion | Private witness, committed | Sample values known by design; predicate leaks a bound |
| Issuer | Public pinned label/key commitment | Known to all observers |
| Issued/expiry times | Private credential fields constrained to public shared batch window | Batch times public; no unique per-holder timestamp output |
| Credential commitment | Hidden during authorization | Issuer knows both leaves; not in SDK result |
| Merkle sibling / direction | Private witness | Issuer/workbench knows both; revoke action exposes leaf bit |
| Batch root | Public | Links all activity to one batch |
| Administrator secret | Private witness | Local sample engine holds it; production custody unresolved |
| Administrator commitment | Public | Domain-separated hash |
| Revocation bits / issuer active | Public | Timing and bit position visible; no strong anonymity in two-leaf batch |
| Audience, policy, nonce, deadline, domain | Public circuit context | Application and network metadata observable |
| Request hash | Public one-time consumption state | No holder input; same request is linkable |
| Verification result | Eligible, policy, reference, execution mode | No globally stable holder identifier |
| Legacy nullifier | Public, stable within application | Existing path only; not a V2 request identifier |

## Parties and guarantees

**Issuer:** knows sample credentials and secrets. Issuer anonymity is not achieved. Bearer records can be copied. The small batch cannot provide meaningful anonymity; do not claim cryptographic unlinkability against a knowledgeable issuer.

**Verifier:** SDK takes challenge ID and transaction reference, not credential payload. Different audiences get independently random challenges and request hashes, without a universal holder identifier. This avoids automatic identifier linkage, but does not establish network anonymity or guarantee non-correlation.

**Browser/frontend:** legacy unlocked plaintext and passphrase are exposed to compromised script/extensions. AES-GCM ciphertext in localStorage is assessed as acceptable only for a development prototype with strong passphrases; encryption does not mitigate XSS while unlocked. JavaScript cannot ensure secure erasure. No recovery or encrypted export UI is supplied.

**Prover:** the existing loopback proof service sees witnesses. A remote prover would enlarge the trust boundary. V2 workbench runs generated JavaScript server-side with sample witnesses; it is not confidential proving and must not receive real credentials.

**Network observers:** transaction timing, fees, wallet activity, batch identities, status changes and audience remain visible. Reusing a wallet can correlate independent applications regardless of credential-field confidentiality.

**Public ledger:** V2 authorization publishes a request key, with status and time constraints. Circuit shape tests and transaction scans are complementary; generated execution is not transaction privacy evidence. No V2 network privacy scan has yet run successfully.

## Claims explicitly excluded

Non-transferability, identity verification, production confidentiality, issuer blindness, two-leaf anonymity, anonymous network traffic, revocation of previously issued application tokens, durable workbench state and standards-compliant signed credentials are not delivered.
