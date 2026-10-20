// Browser-compatible transport for the signed-issuance holder backup format.
const PURPOSE = "veilpass:holder-backup:v1";
const ITERATIONS = 600000;
const LIMIT = 1024 * 1024;
const hex = (b: Uint8Array) =>
  Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) =>
  Uint8Array.from(s.match(/../g) || [], (n) => parseInt(n, 16));
const base64 = (b: Uint8Array) => {
  let result = "";
  for (let i = 0; i < b.length; i += 8192)
    result += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(result);
};
function passphraseCheck(passphrase: string) {
  if (passphrase.length < 12 || passphrase.length > 1024)
    throw new Error("Use a backup passphrase of 12–1024 characters.");
}
async function key(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export function inspectBackup(text: string) {
  if (text.length > 1500000) throw new Error("Backup too large.");
  const b = JSON.parse(text);
  if (
    !b ||
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
    throw new Error("Unsupported holder backup.");
  const cipher = Uint8Array.from(atob(b.ciphertext), (c) => c.charCodeAt(0));
  if (
    !cipher.length ||
    cipher.length > LIMIT ||
    base64(cipher) !== b.ciphertext
  )
    throw new Error("Invalid backup encoding.");
  return { salt: unhex(b.salt), iv: unhex(b.iv), tag: unhex(b.tag), cipher };
}
export async function encryptHolderBackup(plain: string, passphrase: string) {
  passphraseCheck(passphrase);
  const data = new TextEncoder().encode(plain);
  if (!data.length || data.length > LIMIT)
    throw new Error("Invalid backup size.");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(PURPOSE),
      },
      await key(passphrase, salt),
      data,
    ),
  );
  return JSON.stringify({
    version: 1,
    purpose: PURPOSE,
    kdf: "pbkdf2-sha256",
    iterations: ITERATIONS,
    salt: hex(salt),
    iv: hex(iv),
    tag: hex(sealed.slice(-16)),
    ciphertext: base64(sealed.slice(0, -16)),
  });
}
export async function decryptHolderBackup(text: string, passphrase: string) {
  try {
    passphraseCheck(passphrase);
    const b = inspectBackup(text),
      sealed = new Uint8Array(b.cipher.length + 16);
    sealed.set(b.cipher);
    sealed.set(b.tag, b.cipher.length);
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: b.iv as BufferSource,
        additionalData: new TextEncoder().encode(PURPOSE),
      },
      await key(passphrase, b.salt),
      sealed,
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(plain);
  } catch {
    throw new Error(
      "Could not unlock holder backup. Check the file and passphrase.",
    );
  }
}
// Structural recovery only. Issuer trust, signatures, ownership and revocation
// must be checked by the signed-issuance module before this data can be used.
export function inspectHolderPayload(plain: string) {
  if (plain.length > LIMIT) throw new Error("Invalid holder payload.");
  const p = JSON.parse(plain);
  const bytes32 = (v: unknown) => {
    const b = v as { $veilpass?: string; value?: string } | null;
    return (
      b &&
      b.$veilpass === "bytes" &&
      typeof b.value === "string" &&
      /^[0-9a-f]{64}$/.test(b.value) &&
      Object.keys(b).length === 2
    );
  };
  if (
    !p ||
    p.version !== 1 ||
    typeof p.seed !== "string" ||
    !/^[0-9a-f]{64}$/.test(p.seed) ||
    !bytes32(p.method?.controllerAddress?.bytes) ||
    !bytes32(p.method?.methodId) ||
    !Array.isArray(p.credentials) ||
    p.credentials.length > 64
  )
    throw new Error("Invalid holder payload.");
  return { credentialCount: p.credentials.length };
}
