// Offline authority recovery. Does not restore accounts, verifier receipts or provider backups.
import { readFile, writeFile, mkdir, lstat } from "node:fs/promises";
import { parseEnv } from "node:util";
import path from "node:path";
import { operatorStorage } from "../integrations/issuance/src/operator-storage.js";
const [envFile, action, input] = process.argv.slice(2);
if (!envFile || !["backup", "restore-empty", "rotate-storage-key"].includes(action))
  throw new Error("Usage: authority-recovery <private-env-file> backup|restore-empty|rotate-storage-key [private-backup-or-replacement-env-file]");
const env = parseEnv(await readFile(envFile, "utf8"));
if (!env.DATABASE_URL || !env.VEILPASS_ISSUER_STORAGE_KEY || !env.VEILPASS_ISSUER_FINGERPRINT)
  throw new Error("Private environment must include database URL, storage key and pinned fingerprint");
const db = operatorStorage({ ...env, VEILPASS_DATABASE_TRANSPORT: process.env.VEILPASS_DATABASE_TRANSPORT || env.VEILPASS_DATABASE_TRANSPORT || "" });
try {
  await db.initialize();
  if (action === "restore-empty") {
    if (!input) throw new Error("A private encrypted backup is required");
    const snapshot = JSON.parse(await readFile(input, "utf8"));
    if (snapshot.fingerprint !== env.VEILPASS_ISSUER_FINGERPRINT) throw new Error("Backup does not match pinned issuer");
    await db.restoreSnapshot(snapshot, env.VEILPASS_ISSUER_STORAGE_KEY);
    console.log("Authority restored to empty target. Keep writes and network proofs disabled until revocation reconciliation is complete.");
  } else {
    const snapshot = await db.encryptedSnapshot(env.VEILPASS_ISSUER_STORAGE_KEY);
    if (snapshot.fingerprint !== env.VEILPASS_ISSUER_FINGERPRINT) throw new Error("Issuer does not match pinned fingerprint");
    const directory = path.resolve(".private/hosted-preprod/backups");
    await mkdir(directory, { mode: 0o700, recursive: true });
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
      (process.getuid && stat.uid !== process.getuid())) throw new Error("Backup directory must be owner-only");
    const target = path.join(directory, `authority-${Date.now()}.json`);
    await writeFile(target, JSON.stringify(snapshot), { mode: 0o600, flag: "wx" });
    if (action === "rotate-storage-key") {
      if (!input) throw new Error("Replacement private environment file required; stop backend writes before rotation");
      const replacement = parseEnv(await readFile(input, "utf8"));
      if (!replacement.VEILPASS_ISSUER_STORAGE_KEY) throw new Error("Replacement key missing");
      await db.rotateStorageKey(env.VEILPASS_ISSUER_STORAGE_KEY, replacement.VEILPASS_ISSUER_STORAGE_KEY);
      console.log("Storage key rotated without changing signing identity. Update Render secret before resuming service. Keep old backup and key paired.");
    }
    console.log(`Encrypted authority backup saved to ${target}. This is not a full database backup.`);
  }
} finally { await db.close(); }
