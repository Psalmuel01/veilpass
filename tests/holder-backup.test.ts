import { describe, it, expect } from "vitest";
import {
  createCipheriv,
  pbkdf2Sync,
  randomBytes,
  createDecipheriv,
} from "node:crypto";
import {
  encryptHolderBackup,
  decryptHolderBackup,
  inspectHolderPayload,
} from "../packages/holder-backup";
const pass = "a long recovery passphrase";
const purpose = "veilpass:holder-backup:v1";
describe("browser holder backup interoperability", () => {
  it("decrypts the Node issuance format and Node decrypts browser exports", async () => {
    const plain = "signed holder payload";
    const salt = randomBytes(16),
      iv = randomBytes(12),
      key = pbkdf2Sync(pass, salt, 600000, 32, "sha256");
    const c = createCipheriv("aes-256-gcm", key, iv);
    c.setAAD(Buffer.from(purpose));
    const ciphertext = Buffer.concat([c.update(plain), c.final()]);
    const node = JSON.stringify({
      version: 1,
      purpose,
      kdf: "pbkdf2-sha256",
      iterations: 600000,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      tag: c.getAuthTag().toString("hex"),
      ciphertext: ciphertext.toString("base64"),
    });
    expect(await decryptHolderBackup(node, pass)).toBe(plain);
    const b = JSON.parse(await encryptHolderBackup(plain, pass));
    const d = createDecipheriv(
      "aes-256-gcm",
      pbkdf2Sync(pass, Buffer.from(b.salt, "hex"), b.iterations, 32, "sha256"),
      Buffer.from(b.iv, "hex"),
    );
    d.setAAD(Buffer.from(purpose));
    d.setAuthTag(Buffer.from(b.tag, "hex"));
    expect(
      Buffer.concat([
        d.update(Buffer.from(b.ciphertext, "base64")),
        d.final(),
      ]).toString(),
    ).toBe(plain);
  });
  it("rejects wrong passwords, tampering, altered KDF and oversized files", async () => {
    const text = await encryptHolderBackup("private", pass);
    await expect(
      decryptHolderBackup(text, "incorrect password"),
    ).rejects.toThrow("Could not unlock");
    const b = JSON.parse(text);
    b.tag = "00".repeat(16);
    await expect(
      decryptHolderBackup(JSON.stringify(b), pass),
    ).rejects.toThrow();
    b.iterations = 1;
    await expect(
      decryptHolderBackup(JSON.stringify(b), pass),
    ).rejects.toThrow();
    await expect(
      decryptHolderBackup("x".repeat(1500001), pass),
    ).rejects.toThrow();
    await expect(encryptHolderBackup("private", "short")).rejects.toThrow();
  });
  it("checks holder payload shape without claiming credential validation", () => {
    const bytes = { $veilpass: "bytes", value: "ab".repeat(32) };
    const payload = {
      version: 1,
      seed: "cd".repeat(32),
      method: { controllerAddress: { bytes }, methodId: bytes },
      credentials: [{}],
    };
    expect(inspectHolderPayload(JSON.stringify(payload))).toEqual({
      credentialCount: 1,
    });
    expect(() =>
      inspectHolderPayload(JSON.stringify({ ...payload, seed: "bad" })),
    ).toThrow();
    expect(() =>
      inspectHolderPayload(
        JSON.stringify({ ...payload, credentials: Array(65).fill({}) }),
      ),
    ).toThrow();
  });
});
