import { createHash } from "node:crypto";
import { lstat, open, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { withIssuer } from "./service.js";
import { encodeWire } from "./wire.js";

export async function bootstrapIssuer(directory: string, storageKey: string, allowCreate = false) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const marker = path.join(directory, "identity.sha256");
  const exists = async (file: string) => {
    try { await lstat(file); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
  };
  const hasMarker = await exists(marker), hasDatabase = await exists(path.join(directory, "issuer.sqlite"));
  if (hasMarker && !hasDatabase)
    throw new Error("Issuer database missing: restore the backup; refusing a new identity");
  if (!hasMarker && !allowCreate)
    throw new Error("Issuer bootstrap requires explicit authorization");
  if (hasMarker) {
    const stat = await lstat(marker);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid()))
      throw new Error("Issuer identity marker must be owner-only");
  }
  const fingerprint = await withIssuer(directory, storageKey, (issuer) =>
    createHash("sha256").update(encodeWire(issuer.publicTrust())).digest("hex"));
  if (hasMarker) {
    if ((await readFile(marker, "utf8")).trim() !== fingerprint)
      throw new Error("Issuer identity changed: restore the matching database and key");
  } else {
    const handle = await open(marker, "wx", 0o600);
    try { await handle.writeFile(fingerprint + "\n"); await handle.sync(); }
    finally { await handle.close(); }
  }
  return fingerprint;
}
