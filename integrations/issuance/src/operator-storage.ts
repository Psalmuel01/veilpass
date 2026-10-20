// Explicit administrative HTTPS transport for Neon. The deployed backend keeps pg/TLS.
import { neon } from "@neondatabase/serverless";
import { PostgresStorage } from "./postgres.js";
export function operatorStorage(env: Record<string, string>) {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL required");
  if (env.VEILPASS_DATABASE_TRANSPORT !== "neon-http") return new PostgresStorage(env.DATABASE_URL);
  const url = new URL(env.DATABASE_URL);
  if (!/^[a-z0-9.-]+\.neon\.tech$/.test(url.hostname) || url.port || url.username === "" || url.password === "")
    throw new Error("Neon HTTPS transport requires a standard neon.tech endpoint");
  const sql = neon(env.DATABASE_URL, { fullResults: true });
  return new PostgresStorage(env.DATABASE_URL, false, {
    async query(query, values) {
      const result = await sql.query(query, values, { fetchOptions: { signal: AbortSignal.timeout(30000), redirect: "error" } });
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async end() { /* HTTP requests have no persistent connection. */ },
  });
}
