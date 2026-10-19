# AKINDO product form — ready-to-paste copy

## Product name

VeilPass

## Tagline

Prove what qualifies you. Reveal nothing else.

## Product type

Prototype

The core flow works on a real disposable local Midnight network. This classification reflects the remaining production and public-deployment work.

## GitHub repository

https://github.com/Psalmuel01/veilpass

## Product icon

Upload `docs/submission-assets/veilpass-icon.png`.

## Image gallery

Upload these five images in order:

1. `docs/submission-assets/01-product.png` — redesigned product website.
2. `docs/submission-assets/02-qualification.png` — qualification workspace; generated-execution sandbox.
3. `docs/submission-assets/03-confirmed-proof.png` — real local Midnight confirmation and independent SDK acceptance.
4. `docs/submission-assets/04-replay-rejected.png` — a consumed challenge cannot be reused.
5. `docs/submission-assets/05-revocation-enforced.png` — fresh authorization rejected after real on-chain revocation.

## About — paste the Markdown below

```markdown
## What it does

VeilPass lets developers prove that they meet an application's qualification policy without handing that application their full credential.

A single developer-training qualification can unlock two experiences: hackathon entry and a professional community requiring level-two training. Each application gets a fresh, audience-bound authorization and a minimal eligibility result instead of the underlying qualification.

The working V2 browser flow generates real zero-knowledge proofs, submits transactions to a local Midnight network, and independently verifies the confirmed authorization through our server-side SDK. It also rejects replayed challenges and enforces issuer revocation.

## The problem it solves

Applications often need a simple eligibility answer, yet ask people to upload complete certificates or training records. This creates unnecessary disclosure and duplicated data storage. Static credentials also become stale when an issuer withdraws eligibility.

VeilPass separates proof of qualification from disclosure of the record, while checking that the qualification is still valid when authorization is verified.

## Challenges I ran into

The hardest part was connecting a private proof to the exact request an application issued. We bound challenges to the audience, policy, network, contract, nonce and deadline, then added durable one-time consumption to prevent replay.

A confirmed transaction also had to be independently checked. The SDK pins the deployment and circuit verifier keys, inspects real transaction evidence, and reads current canonical issuer and revocation status. Integrating the pinned ledger's transaction identifiers and Compact transcript encoding required dedicated regression coverage.

We also kept generated constraint execution explicitly separate from real proof-backed verification, so the interface and recorded evidence describe exactly what happened.

## Technologies I used

Midnight, Compact, Midnight.js, TypeScript, Next.js, React, Tailwind CSS, Playwright, Vitest and Docker.

## How we built it

We preserved the original proof-backed wallet and added a separate V2 qualification lifecycle contract with private membership witnesses, two application policies, validity checks, administrator-authorized revocation and issuer deactivation.

The browser keeps the imported V2 qualification in memory. A holder-controlled local prover receives private witnesses; the verifier API receives the challenge and transaction reference rather than the qualification. A funded testkit wallet connects through a connector bridge for the recorded local demonstration.

Our source SDK provides typed challenges, independent chain verification and durable challenge storage. The product includes a qualification workspace, reference applications, developer documentation, responsive layouts, and persistent light/dark mode.

Validation includes 50 passing automated tests and a real browser lifecycle: two confirmed policy authorizations, SDK acceptance, replay rejection, confirmed revocation, rejection of the previous receipt, and rejection of a fresh attempt afterward.

## What we learned

Privacy needs a complete authorization lifecycle. Authenticity alone is insufficient: eligibility also depends on request freshness, the intended application, current issuer status, revocation and safe handling of private witnesses.

Clear trust boundaries matter just as much as the proof. Our verifier relies on an operator-configured indexer, the local prover sees private witnesses, and wallet or timing metadata can still correlate activity.

## What's next for VeilPass

The current deliverable is a validated local prototype with an issuer-pinned, fixed two-record batch. Authenticity currently comes from pinned Merkle membership rather than signed verifiable credentials, and sample holder secrets are issuer-known bearer material.

Next steps are signed credential issuance, holder-owned key binding, scalable issuance and status management, installed-wallet acceptance testing, Preprod deployment, independently hosted verifier applications and an external issuer/user pilot.

Our goal is practical qualification verification with less disclosure and stronger control over who remains eligible.
```

## Video

Upload `docs/video/veilpass-v2-demo-american.mp4` to YouTube with **Public** visibility. Paste its actual public watch URL here. A local MP4 path does not satisfy this field. No YouTube upload has been performed.

Suggested YouTube title: **VeilPass V2 | Private Qualifications on Midnight | Demo**

Suggested YouTube description:

> VeilPass demonstrates privacy-preserving developer qualification checks on Midnight. This demo shows two real local-network authorizations, independent SDK verification, replay rejection and on-chain revocation enforcement. The generated-execution sandbox and shortened proof waits are labeled. This is a local prototype using a funded testkit connector-bridge wallet, not a Preprod or production deployment. Repository: https://github.com/Psalmuel01/veilpass

## Live demo

https://useveilpass.vercel.app

This is the public product preview. Sample sessions and real proof-backed authorization run locally using the repository setup. The hosted preview is not a public Midnight/Preprod deployment.

## Build with

Midnight

## Product Category — maximum 3

- Identity
- Privacy
- Developer Tools

## Tags — maximum 10

- Midnight
- Compact
- Zero-Knowledge Proofs
- TypeScript
- Next.js
- React
- Tailwind CSS
- Playwright
- Vitest
- Docker

## Product detail visibility

Show

## Social/contact fields

Use only your actual contact links and email. Leave optional fields blank when unused.

## Current publication status

Checked public `main`: `27961bf`. It includes the core V2 implementation and implementation summary. The later demo-recording and neural-narration helper commits are local (`dab6973`, `90d76a3`); they have not been pushed. The video itself is a generated, Git-ignored artifact and must be uploaded separately.
