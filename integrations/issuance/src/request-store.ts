// Durable, global pilot limits. Caller identities and forwarded IPs are never
// trusted. A single persistent replica shares these counters across restarts.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, lstatSync, openSync, closeSync } from "node:fs";
import path from "node:path";

export class RequestStore {
  private db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const secure = (s: { mode: number; uid: number }) =>
      !(s.mode & 0o077) && (typeof process.getuid !== "function" || s.uid === process.getuid());
    const parent = lstatSync(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink() || !secure(parent))
      throw new Error("Request store directory must be owner-only");
    const file = path.join(directory, "requests.sqlite");
    try { closeSync(openSync(file, "wx", 0o600)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !secure(stat))
      throw new Error("Request store database must be owner-only");
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)");
  }
  take(bucket: string, limit: number, windowMs: number, now = Date.now()) {
    if (!/^[a-z-]{1,40}$/.test(bucket) || !Number.isSafeInteger(limit) || limit < 1 ||
        !Number.isSafeInteger(windowMs) || windowMs < 1000 ||
        !Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(now + windowMs))
      throw new Error("Invalid request limit");
    // One statement makes admission atomic, including across SQLite connections.
    const row = this.db.prepare(`INSERT INTO limits(bucket,count,until) VALUES(?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET
        count=CASE WHEN limits.until<=? THEN 1 ELSE limits.count+1 END,
        until=CASE WHEN limits.until<=? THEN excluded.until ELSE limits.until END
      WHERE limits.until<=? OR limits.count<? RETURNING count`)
      .get(bucket, now + windowMs, now, now, now, limit);
    return !!row;
  }
  close() { this.db.close(); }
}
