// Server-only durable storage for hosts with ephemeral filesystems.
import { Pool, type PoolConfig } from "pg";
import { createHash } from "node:crypto";
import { IssuerAuthority } from "./index.js";
import { encryptBackup, decryptBackup } from "./backup.js";
import { encodeWire } from "./wire.js";
import type { ChallengeV3, ChallengeStoreV3 } from "./verifier.js";

export function postgresConfig(connectionString: string, allowLocal = false): PoolConfig {
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error("Invalid database configuration"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      !url.username || !url.password || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.hash)
    throw new Error("Invalid database configuration");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (local && !allowLocal) throw new Error("Local database requires explicit test configuration");
  // Do not pass URL query options into pg: sslmode=require can replace explicit
  // TLS verification settings. Remote connections always validate certificates.
  return {
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: local && allowLocal ? false : { rejectUnauthorized: true },
    max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 15000,
    statement_timeout: 15000, query_timeout: 20000,
    application_name: "veilpass-preprod",
  };
}

export class PostgresStorage {
  readonly pool: Pool;
  constructor(connectionString: string, allowLocal = false) {
    this.pool = new Pool(postgresConfig(connectionString, allowLocal));
    this.pool.on("error", () => console.error("Database connection unavailable"));
  }
  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS veilpass_authority (
        id INTEGER PRIMARY KEY CHECK(id=1), version BIGINT NOT NULL,
        encrypted TEXT NOT NULL, fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS veilpass_challenges (
        namespace TEXT NOT NULL, id TEXT NOT NULL, body JSONB NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE, expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(namespace,id));
      CREATE INDEX IF NOT EXISTS veilpass_challenges_expiry ON veilpass_challenges(expires_at);
      CREATE TABLE IF NOT EXISTS veilpass_limits (
        bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, until TIMESTAMPTZ NOT NULL);
    `);
  }
  async bootstrap(password: string, allowCreate = false) {
    this.password(password);
    if (allowCreate) {
      const issuer = new IssuerAuthority();
      await this.pool.query(
        "INSERT INTO veilpass_authority(id,version,encrypted,fingerprint) VALUES(1,1,$1,$2) ON CONFLICT(id) DO NOTHING",
        [await encryptBackup(issuer.exportState(), password), this.fingerprint(issuer)],
      );
    }
    const { rows } = await this.pool.query("SELECT encrypted,fingerprint FROM veilpass_authority WHERE id=1");
    if (!rows.length) throw new Error("Issuer missing: explicit bootstrap or backup restoration required");
    const issuer = IssuerAuthority.fromState(await decryptBackup(rows[0].encrypted, password));
    if (this.fingerprint(issuer) !== rows[0].fingerprint) throw new Error("Pinned issuer identity mismatch");
    return rows[0].fingerprint as string;
  }
  async withIssuer<T>(password: string, operation: (issuer: IssuerAuthority) => T): Promise<T> {
    this.password(password);
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows } = await this.pool.query("SELECT version,encrypted,fingerprint FROM veilpass_authority WHERE id=1");
      const row = rows[0];
      if (!row) throw new Error("Issuer not initialized");
      const issuer = IssuerAuthority.fromState(await decryptBackup(row.encrypted, password));
      if (this.fingerprint(issuer) !== row.fingerprint) throw new Error("Pinned issuer identity mismatch");
      const result = operation(issuer);
      if (result instanceof Promise) throw new Error("Issuer operations must be synchronous");
      if (this.fingerprint(issuer) !== row.fingerprint) throw new Error("Issuer identity cannot change during a request");
      const updated = await this.pool.query(
        "UPDATE veilpass_authority SET encrypted=$1,version=version+1 WHERE id=1 AND version=$2",
        [await encryptBackup(issuer.exportState(), password), row.version],
      );
      if (updated.rowCount === 1) return result;
    }
    throw new Error("Issuer busy; retry the request");
  }
  async take(bucket: string, limit: number, windowSeconds: number) {
    if (!/^[a-z-]{1,40}$/.test(bucket) || !Number.isSafeInteger(limit) || limit < 1 ||
        !Number.isSafeInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86400)
      throw new Error("Invalid request budget");
    const result = await this.pool.query(`
      INSERT INTO veilpass_limits(bucket,count,until) VALUES($1,1,clock_timestamp()+$3*INTERVAL '1 second')
      ON CONFLICT(bucket) DO UPDATE SET
        count=CASE WHEN veilpass_limits.until<=clock_timestamp() THEN 1 ELSE veilpass_limits.count+1 END,
        until=CASE WHEN veilpass_limits.until<=clock_timestamp() THEN excluded.until ELSE veilpass_limits.until END
      WHERE veilpass_limits.until<=clock_timestamp() OR veilpass_limits.count<$2 RETURNING count`,
      [bucket, limit, windowSeconds]);
    return result.rowCount === 1;
  }
  challengeStore(namespace: string) { return new PostgresChallengeStore(this.pool, namespace); }
  async close() { await this.pool.end(); }
  private password(value: string) {
    if (value.length < 32 || value.length > 1024) throw new Error("Invalid issuer storage key");
  }
  private fingerprint(issuer: IssuerAuthority) {
    return createHash("sha256").update(encodeWire(issuer.publicTrust())).digest("hex");
  }
}

export class PostgresChallengeStore implements ChallengeStoreV3 {
  constructor(private pool: Pool, private namespace: string) {
    if (!/^[0-9a-f]{64}:[12]$/.test(namespace)) throw new Error("Invalid verifier namespace");
  }
  async put(challenge: ChallengeV3) {
    this.id(challenge.id);
    if (!Number.isSafeInteger(challenge.expiresAt)) throw new Error("Invalid challenge expiry");
    // Expired receipts cannot authorize. Bound storage independently of restarts.
    await this.pool.query("DELETE FROM veilpass_challenges WHERE expires_at<clock_timestamp()-INTERVAL '1 day'");
    await this.pool.query("INSERT INTO veilpass_challenges(namespace,id,body,expires_at) VALUES($1,$2,$3,to_timestamp($4))",
      [this.namespace, challenge.id, JSON.stringify(challenge), challenge.expiresAt]);
  }
  async get(id: string): Promise<ChallengeV3 | null> {
    this.id(id);
    const { rows } = await this.pool.query("SELECT body FROM veilpass_challenges WHERE namespace=$1 AND id=$2", [this.namespace, id]);
    return rows[0]?.body ?? null;
  }
  async consume(id: string) {
    this.id(id);
    const result = await this.pool.query("UPDATE veilpass_challenges SET used=TRUE WHERE namespace=$1 AND id=$2 AND used=FALSE AND expires_at>clock_timestamp()",
      [this.namespace, id]);
    return result.rowCount === 1;
  }
  close() { /* The process owns the shared pool; a request must not close it. */ }
  private id(value: string) { if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("Invalid challenge ID"); }
}

let storage: PostgresStorage | undefined;
export function hostedDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("Hosted database is not configured");
  return storage ??= new PostgresStorage(process.env.DATABASE_URL,
    process.env.VEILPASS_TEST_DATABASE_LOCAL === "1");
}
