// SPDX-License-Identifier: Apache-2.0
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import {
  IssuerAuthority,
  Holder,
  LocalVerifier,
  encodeWire,
  decodeWire,
  type EnrollmentRequest,
  type SignedQualification,
} from "./src/index.js";
const issuer = new IssuerAuthority(),
  holder = new Holder();
const request = holder.request(issuer.approve(2));
// Transport only the public enrollment context and holder signature.
const qualification = issuer.issue(
  decodeWire(encodeWire(request)) as EnrollmentRequest,
);
const id = holder.accept(
  decodeWire(encodeWire(qualification)) as SignedQualification,
  issuer.publicTrust(),
);
const first = new LocalVerifier(
  issuer.statusReader(),
  "veilpass:local:signed",
  "hackathon.example",
  1,
);
const second = new LocalVerifier(
  issuer.statusReader(),
  "veilpass:local:signed",
  "community.example",
  2,
);
const witness = holder.present(id, first.challenge()),
  firstReceipt = first.verify(witness);
assert.throws(() => first.verify(witness), /consumed/);
const passphrase = randomBytes(24).toString("base64");
const encryptedBackup = await holder.backup(passphrase);
holder.lock();
const recovered = await Holder.restore(encryptedBackup, passphrase);
const secondReceipt = second.verify(recovered.present(id, second.challenge()));
const pending = first.challenge(),
  pendingWitness = recovered.present(id, pending);
issuer.revoke(id);
assert.throws(() => first.verify(pendingWitness), /revoked/);
assert.throws(
  () => second.verify(recovered.present(id, second.challenge())),
  /revoked/,
);
recovered.lock();
console.log(
  JSON.stringify(
    {
      mode: "local-signed-credential",
      issuerAndHolderSignatures:
        "Real Jubjub signatures checked with official credential-compact 0.3.0 and generated Compact constraints",
      zkTransaction: false,
      firstReceipt,
      secondReceipt,
      replayRejected: true,
      encryptedBackupRestored: true,
      preRevocationPresentationRejected: true,
      freshRevokedPresentationRejected: true,
      holderSecretSentToIssuer: false,
      holderSecretInPresentationWitness: false,
      statusStorage:
        "Ephemeral local issuer registry; not a ledger status check",
    },
    null,
    2,
  ),
);
