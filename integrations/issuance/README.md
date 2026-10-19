# Signed issuance and holder ownership — local milestone

This isolated Node 24 integration implements real issuer and holder signatures using the official Midnight credential libraries. It is the first implementation milestone toward replacing V2's issuer-known bearer secrets.

**It is not integrated into `/live`, the V2 contract/SDK, or the hosted app.** Its Compact routines run as generated constraint execution. No new ZK proof, transaction, public issuer service or deployed status registry is claimed. The existing V2 flow and Node 22 Vercel deployment remain separate.

## Run it

From the repository root, install the pinned compiler if it is absent:

```sh
npm run toolchain:install
cd integrations/issuance
nvm install
nvm use
npm ci
npm run validate
npm run demo
```

The module pins Node 24.22.0 in `.nvmrc`, Compact 0.31.1, runtime 0.16.0, `credential-compact`/`credential-model` 0.3.0, and `midnight-did-jubjub-schnorr` 0.7.0. `COMPACTC` can point to another verified 0.31.1 compiler. The module's compiler script checks the exact compiler version. Root Node 22 commands continue to work independently.

`validate` compiles the credential family, type-checks the integration, runs its tests and the demo, and writes sanitized results to [`docs/evidence/signed-issuance-local.json`](../../docs/evidence/signed-issuance-local.json). It does not start Docker or any server.

## What works

- The holder generates a signing seed locally. The issuer receives only public enrollment context and a proof of key possession.
- The trusted local issuer operator approves level 1 or level 2 before issuing a short-lived enrollment challenge. The applicant cannot upgrade the approved level. Enrollment proofs are bound to the issuer, holder, nonce and deadline, and an offer is consumed once.
- The issuer signs a credential body committing to the qualification and the holder's public key. A holder cannot import a credential issued to a different key.
- Each application issues a fresh contextual challenge. The holder signs the exact presentation body; generated Compact routines verify the pinned issuer signature, holder signature and key binding. Both policies work with the same qualification.
- Signatures cannot be replayed across issuance/presentation contexts. The application also checks its own domain, audience, policy, nonce, deadline, credential validity and current issuer status.
- Replay, copied credentials, substituted keys, tampering, wrong issuers and insufficient qualification levels fail. Invalid submissions do not consume valid requests, allowing a safe retry.
- A trusted local registry enforces issuer deactivation and irreversible revocation. Old pending presentations and fresh attempts fail after revocation, including after holder recovery.
- Holder backups use AES-256-GCM with fresh salt/IV, a purpose-bound authenticated payload and PBKDF2-HMAC-SHA256 at 600,000 iterations. Weak/oversized inputs and altered KDF parameters are rejected. Use a long, unique backup passphrase.
- File storage creates owner-only directories/files, refuses overwrites and symlinks, bounds reads, and synchronizes written backup data. Recovery restores the same holder key and credentials; it does not bypass revocation.

## How to use the local API

```ts
import { IssuerAuthority, Holder, LocalVerifier } from "./src/index.js";
import { saveHolderBackup, loadHolderBackup } from "./src/storage.js";

const issuer = new IssuerAuthority(); // Trusted local operator; not a public API.
const holder = new Holder(); // Holder-side key generation.
const offer = issuer.approve(2); // Approval comes from the issuer, not the applicant.
const signed = issuer.issue(holder.request(offer));
const id = holder.accept(signed, issuer.publicTrust());
const verifier = new LocalVerifier(
  issuer.statusReader(),
  "veilpass:local:signed",
  "hackathon.example",
  1,
);
const receipt = verifier.verify(holder.present(id, verifier.challenge()));

await saveHolderBackup(
  "/your/private-directory/holder.backup.json",
  holder,
  passphrase,
);
holder.lock();
const restored = await loadHolderBackup(
  "/your/private-directory/holder.backup.json",
  passphrase,
);
issuer.revoke(id);
// Both old and newly created presentations are now rejected by the verifier.
```

Keep each role in its own trust boundary when integrating it. The demo uses separate objects in one process, not a hostile-server/device-isolation test. `encodeWire`/`decodeWire` provide bounded JSON transport of native Compact bytes and integers; do not send private witnesses to a remote verifier API in place of a ZK proof.

## Cryptography and trust

The family imports the official `credential-compact` source instead of vendoring or inventing signature verification. The signing adapter in `src/crypto.ts` uses the official VC context/challenge functions, official DID seed/key helpers, runtime curve operations, a fresh rejection-sampled nonce and the standard Schnorr response. The DID library's payload-signing helper is deliberately not used: its challenge derivation differs from the VC context. The signing adapter and application composition still require independent security review before production use.

Issuer keys and local registry references are pinned by the consuming verifier. The method references here are local opaque references, not resolved DIDs. A valid signature does not establish an institution's legitimacy or a person's identity. This implementation does not authenticate users through OAuth, a passkey, a wallet extension or a training provider's account system.

The issuer knows approved claims, enrollment public keys and credential status handles. Holder signing seeds are absent from enrollment payloads and presentation witnesses. The local constraint checker receives the credential and private claims: this is not a privacy-preserving network presentation yet. The issuer/registry and verifier request stores are ephemeral, single-process objects; they are not durable production services. JavaScript memory is not a hardware-backed keystore, and `lock` is not a guarantee of complete memory erasure.

An encrypted backup restores the original key. Lost-all-backups recovery, key rotation, recovery-authorized reissuance, durable issuer key custody and public administration remain unimplemented. A forgotten passphrase cannot be reset by this module.

## Next integration gate

1. Validate a deliberate Node 24 application/tooling migration with the existing app and wallet stack.
2. Compose these official credential/holder checks into a separately versioned ledger contract with pinned issuer authority and current status enforcement. Do not silently reinterpret V2's witness schema.
3. Generate new proof artifacts, extend the chain adapter's pinned keys/transcript handling, and run the actual proof-backed network lifecycle.
4. Add holder-side browser key custody and signing before witnesses reach the local prover. Add authenticated issuer approval/issuance and durable status/request storage.
5. Test installed-wallet declines, disconnects, slow proofs and safe retries before Preprod and an external pilot.

Source references: [Midnight identity/credentials](https://docs.midnight.network/concepts/identity), [official VC project](https://github.com/midnightntwrk/midnight-verifiable-credentials), [official DID signing implementation](https://github.com/midnightntwrk/midnight-did), [OWASP password-based key derivation guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
