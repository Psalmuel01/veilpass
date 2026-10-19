// SPDX-License-Identifier: Apache-2.0
import {
  createCipheriv,
  createDecipheriv,
  pbkdf2,
  randomBytes,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(pbkdf2);
const PURPOSE = "veilpass:holder-backup:v1";
const ITERATIONS = 600000;
export async function encryptBackup(plain: string, passphrase: string) {
  if (passphrase.length < 12 || passphrase.length > 1024)
    throw new Error("Use a backup passphrase of 12–1024 characters");
  if (Buffer.byteLength(plain) > 1024 * 1024)
    throw new Error("Backup too large");
  const salt = randomBytes(16),
    iv = randomBytes(12),
    key = await derive(passphrase, salt, ITERATIONS, 32, "sha256");
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(PURPOSE));
    const ciphertext = Buffer.concat([
      cipher.update(plain, "utf8"),
      cipher.final(),
    ]);
    return JSON.stringify({
      version: 1,
      purpose: PURPOSE,
      kdf: "pbkdf2-sha256",
      iterations: ITERATIONS,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      ciphertext: ciphertext.toString("base64"),
    });
  } finally {
    key.fill(0);
  }
}
export async function decryptBackup(text: string, passphrase: string) {
  try {
    if (text.length > 1500000 || passphrase.length > 1024) throw new Error();
    const b = JSON.parse(text);
    if (
      b.version !== 1 ||
      b.purpose !== PURPOSE ||
      b.kdf !== "pbkdf2-sha256" ||
      b.iterations !== ITERATIONS ||
      typeof b.salt !== "string" ||
      !/^[0-9a-f]{32}$/.test(b.salt) ||
      typeof b.iv !== "string" ||
      !/^[0-9a-f]{24}$/.test(b.iv) ||
      typeof b.tag !== "string" ||
      !/^[0-9a-f]{32}$/.test(b.tag) ||
      typeof b.ciphertext !== "string"
    )
      throw new Error();
    const ciphertext = Buffer.from(b.ciphertext, "base64");
    if (
      !ciphertext.length ||
      ciphertext.toString("base64") !== b.ciphertext ||
      ciphertext.length > 1024 * 1024
    )
      throw new Error();
    const key = await derive(
      passphrase,
      Buffer.from(b.salt, "hex"),
      ITERATIONS,
      32,
      "sha256",
    );
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(b.iv, "hex"),
      );
      decipher.setAAD(Buffer.from(PURPOSE));
      decipher.setAuthTag(Buffer.from(b.tag, "hex"));
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } finally {
      key.fill(0);
    }
  } catch {
    throw new Error("Could not unlock holder backup");
  }
}
