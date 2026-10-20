// Server-only durable storage for hosts with ephemeral filesystems.
import { Pool, type PoolConfig } from "pg";
import { createHash } from "node:crypto";
import { IssuerAuthority } from "./index.js";
import { encryptBackup, decryptBackup } from "./backup.js";
import { operatorDigest, operatorId, operatorRole, type Operator } from "./operators.js";
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

export type StorageConnection = {
  query(sql: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
  end(): Promise<void>;
};
export class PostgresStorage {
  readonly pool: StorageConnection;
  constructor(connectionString: string, allowLocal = false, connection?: StorageConnection) {
    const config = postgresConfig(connectionString, allowLocal);
    if (connection) this.pool = connection;
    else {
      const pool = new Pool(config);
      pool.on("error", () => console.error("Database connection unavailable"));
      this.pool = pool;
    }
  }
  async initialize() {
    const schema = `
      CREATE TABLE IF NOT EXISTS veilpass_authority (
        id INTEGER PRIMARY KEY CHECK(id=1), version BIGINT NOT NULL,
        encrypted TEXT NOT NULL, fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS veilpass_challenges (
        namespace TEXT NOT NULL, id TEXT NOT NULL, body JSONB NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE, expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(namespace,id));
      CREATE INDEX IF NOT EXISTS veilpass_challenges_expiry ON veilpass_challenges(expires_at);
      CREATE TABLE IF NOT EXISTS veilpass_operators (
        id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('issuer','revoker','administrator')),
        token_hash TEXT UNIQUE NOT NULL, disabled BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
      CREATE TABLE IF NOT EXISTS veilpass_audit (
        sequence BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), authority_version BIGINT);
      CREATE TABLE IF NOT EXISTS veilpass_limits (
        bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, until TIMESTAMPTZ NOT NULL);
    `;
    for (const statement of schema.split(";").filter(s => s.trim())) await this.pool.query(statement);
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
  async withIssuer<T>(password: string, operation: (issuer: IssuerAuthority) => T, audit?: { actor: string; action: string }): Promise<T> {
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
      // One statement commits the state change and its audit event atomically.
      const updated = await this.pool.query(
        `WITH changed AS (
          UPDATE veilpass_authority SET encrypted=$1,version=version+1 WHERE id=1 AND version=$2
          RETURNING version
        ), logged AS (
          INSERT INTO veilpass_audit(actor,action,authority_version)
          SELECT $3,$4,version FROM changed WHERE $3::text IS NOT NULL RETURNING sequence
        ) SELECT version FROM changed`,
        [await encryptBackup(issuer.exportState(), password), row.version,
          audit?.actor ?? null, audit?.action ?? null],
      );
      if (updated.rowCount === 1) return result;
    }
    throw new Error("Issuer busy; retry the request");
  }
  async encryptedSnapshot(password: string) {
    this.password(password);
    const { rows } = await this.pool.query("SELECT version,encrypted,fingerprint FROM veilpass_authority WHERE id=1");
    if (rows.length !== 1) throw new Error("Issuer missing");
    const row = rows[0];
    const issuer = IssuerAuthority.fromState(await decryptBackup(row.encrypted, password));
    if (this.fingerprint(issuer) !== row.fingerprint) throw new Error("Issuer identity mismatch");
    return { version: 1 as const, authorityVersion: String(row.version), encrypted: row.encrypted,
      fingerprint: row.fingerprint as string, capturedAt: new Date().toISOString() };
  }
  async restoreSnapshot(snapshot: { version: number; encrypted: string; fingerprint: string }, password: string) {
    this.password(password);
    if (snapshot.version !== 1 || !/^[0-9a-f]{64}$/.test(snapshot.fingerprint) ||
        typeof snapshot.encrypted !== "string" || snapshot.encrypted.length > 32000000)
      throw new Error("Invalid recovery snapshot");
    const issuer = IssuerAuthority.fromState(await decryptBackup(snapshot.encrypted, password));
    if (this.fingerprint(issuer) !== snapshot.fingerprint) throw new Error("Recovery identity mismatch");
    // Recovery only into an empty authority table. Never overwrite live revocations.
    const result = await this.pool.query(`WITH restored AS (
      INSERT INTO veilpass_authority(id,version,encrypted,fingerprint) VALUES(1,1,$1,$2)
      ON CONFLICT(id) DO NOTHING RETURNING version
    ), logged AS (
      INSERT INTO veilpass_audit(actor,action,authority_version)
      SELECT 'offline-operator','authority:restore',version FROM restored RETURNING sequence
    ) SELECT version FROM restored`, [snapshot.encrypted, snapshot.fingerprint]);
    if (result.rowCount !== 1) throw new Error("Recovery target already contains an issuer");
    return snapshot.fingerprint;
  }
  async rotateStorageKey(oldPassword: string, newPassword: string) {
    this.password(oldPassword); this.password(newPassword);
    if (oldPassword === newPassword) throw new Error("Replacement storage key must differ");
    const snapshot = await this.encryptedSnapshot(oldPassword);
    const state = await decryptBackup(snapshot.encrypted, oldPassword);
    const encrypted = await encryptBackup(state, newPassword);
    const result = await this.pool.query(`WITH changed AS (
      UPDATE veilpass_authority SET encrypted=$1,version=version+1
      WHERE id=1 AND version=$2 AND fingerprint=$3 RETURNING version
    ), logged AS (
      INSERT INTO veilpass_audit(actor,action,authority_version)
      SELECT 'offline-operator','storage-key:rotate',version FROM changed RETURNING sequence
    ) SELECT version FROM changed`, [encrypted, snapshot.authorityVersion, snapshot.fingerprint]);
    if (result.rowCount !== 1) throw new Error("Issuer changed during rotation; stop writes and retry");
    return snapshot.fingerprint;
  }
  async authenticateOperator(token: string): Promise<Operator | null> {
    let digest: string;
    try { digest = operatorDigest(token); } catch { return null; }
    const { rows } = await this.pool.query(
      "SELECT id,role FROM veilpass_operators WHERE token_hash=$1 AND disabled=FALSE AND expires_at>clock_timestamp()", [digest]);
    return rows.length ? { id: rows[0].id, role: operatorRole(rows[0].role) } : null;
  }
  async provisionOperator(id: string, role: string, token: string, expiresAt: number, rotate = false) {
    operatorId(id); operatorRole(role);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 366 * 86400000)
      throw new Error("Operator expiry must be within one year");
    const change = rotate
      ? "UPDATE veilpass_operators SET role=$2,token_hash=$3,disabled=FALSE,expires_at=to_timestamp($4/1000.0),updated_at=clock_timestamp() WHERE id=$1 RETURNING id"
      : "INSERT INTO veilpass_operators(id,role,token_hash,expires_at) VALUES($1,$2,$3,to_timestamp($4/1000.0)) RETURNING id";
    const result = await this.pool.query(`WITH changed AS (${change})
      INSERT INTO veilpass_audit(actor,action) SELECT 'offline-operator',$5 FROM changed RETURNING sequence`,
      [id, role, operatorDigest(token), expiresAt, `operator:${rotate ? "rotate" : "create"}:${id}`]);
    if (result.rowCount !== 1) throw new Error("Operator does not exist");
  }
  async disableOperator(id: string) {
    operatorId(id);
    const result = await this.pool.query(`WITH changed AS (
      UPDATE veilpass_operators SET disabled=TRUE,updated_at=clock_timestamp() WHERE id=$1 RETURNING id
    ) INSERT INTO veilpass_audit(actor,action) SELECT 'offline-operator','operator:disable:'||id FROM changed RETURNING sequence`, [id]);
    if (result.rowCount !== 1) throw new Error("Operator does not exist");
  }
  async operators() {
    return (await this.pool.query("SELECT id,role,disabled,expires_at,updated_at FROM veilpass_operators ORDER BY id")).rows;
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
  constructor(private pool: StorageConnection, private namespace: string) {
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
