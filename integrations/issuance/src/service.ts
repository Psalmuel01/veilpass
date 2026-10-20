// SPDX-License-Identifier: Apache-2.0
// Node-only durable authority. Public browser modules must not import this file.
import { DatabaseSync } from "node:sqlite";
import { mkdir, lstat, open } from "node:fs/promises";
import path from "node:path";
import { IssuerAuthority } from "./index.js";
import { encryptBackup, decryptBackup } from "./backup.js";

export async function withIssuer<T>(
  directory: string,
  password: string,
  operation: (issuer: IssuerAuthority) => T,
): Promise<T> {
  if (password.length < 32 || password.length > 1024)
    throw new Error("Issuer storage key must contain 32–1024 characters");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const owner = (stat: { mode: number; uid: number }) =>
    !(stat.mode & 0o077) &&
    (typeof process.getuid !== "function" || stat.uid === process.getuid());
  const parent = await lstat(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink() || !owner(parent))
    throw new Error("Issuer directory must be owner-only");
  const file = path.join(directory, "issuer.sqlite");
  try {
    const handle = await open(file, "wx", 0o600);
    await handle.close();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || !owner(stat))
    throw new Error("Issuer database must be owner-only");
  const db = new DatabaseSync(file);
  try {
    db.exec(
      "PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS authority (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, encrypted TEXT NOT NULL)",
    );
    for (let attempt = 0; attempt < 5; attempt++) {
      const row = db
        .prepare("SELECT version, encrypted FROM authority WHERE id=1")
        .get() as { version: number; encrypted: string } | undefined;
      const issuer = row
        ? IssuerAuthority.fromState(
            await decryptBackup(row.encrypted, password),
          )
        : new IssuerAuthority();
      // Keep operations synchronous: no external side effects before the CAS commits.
      const result = operation(issuer);
      if (result instanceof Promise)
        throw new Error("Issuer operations must be synchronous");
      const encrypted = await encryptBackup(issuer.exportState(), password);
      const written = row
        ? db
            .prepare(
              "UPDATE authority SET encrypted=?, version=version+1 WHERE id=1 AND version=?",
            )
            .run(encrypted, row.version).changes
        : db
            .prepare(
              "INSERT OR IGNORE INTO authority(id,version,encrypted) VALUES(1,1,?)",
            )
            .run(encrypted).changes;
      if (written === 1) return result;
    }
    throw new Error("Issuer busy; retry the request");
  } finally {
    db.close();
  }
}
