// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, lstatSync, openSync, closeSync } from "node:fs";
import path from "node:path";
import type { ChallengeV3, ChallengeStoreV3 } from "./verifier.js";
export class SqliteChallengeStore implements ChallengeStoreV3 {
  #db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const owner = (stat: { mode: number; uid: number }) =>
      !(stat.mode & 0o077) &&
      (typeof process.getuid !== "function" || stat.uid === process.getuid());
    const parent = lstatSync(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink() || !owner(parent))
      throw new Error("Verifier directory must be owner-only");
    const file = path.join(directory, "challenges.sqlite");
    try {
      closeSync(openSync(file, "wx", 0o600));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !owner(stat))
      throw new Error("Verifier database must be owner-only");
    this.#db = new DatabaseSync(file);
    this.#db.exec(
      "PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, body TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0)",
    );
  }
  async put(c: ChallengeV3) {
    this.#id(c.id);
    this.#db
      .prepare("INSERT INTO challenges(id,body) VALUES(?,?)")
      .run(c.id, JSON.stringify(c));
  }
  async get(id: string): Promise<ChallengeV3 | null> {
    this.#id(id);
    const row = this.#db
      .prepare("SELECT body FROM challenges WHERE id=?")
      .get(id) as { body: string } | undefined;
    return row ? JSON.parse(row.body) : null;
  }
  async consume(id: string) {
    this.#id(id);
    return (
      this.#db
        .prepare("UPDATE challenges SET used=1 WHERE id=? AND used=0")
        .run(id).changes === 1
    );
  }
  #id(id: string) {
    if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("Invalid challenge ID");
  }
  close() {
    this.#db.close();
  }
}
