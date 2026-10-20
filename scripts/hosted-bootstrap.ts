// Initialize the operator-selected remote database without logging credentials.
import { mkdir, open, readFile, lstat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PostgresStorage } from "../integrations/issuance/src/postgres.js";

if (!process.argv.includes("--create")) throw new Error("Pass --create to explicitly initialize this issuer");
process.loadEnvFile(process.argv[2] || ".env.prepod");
if (!process.env.DATABASE_URL || !process.env.BLOCKFROST_PROJECT_ID)
  throw new Error("Database and Blockfrost configuration are required");
const directory = path.resolve(".private/hosted-preprod");
await mkdir(directory, { recursive: true, mode: 0o700 });
const owner = (s: { mode: number; uid: number }) => !(s.mode & 0o077) &&
  (typeof process.getuid !== "function" || s.uid === process.getuid());
const parent = await lstat(directory);
if (!parent.isDirectory() || parent.isSymbolicLink() || !owner(parent)) throw new Error("Unsafe hosted secret directory");
const file = path.join(directory, "service-secrets.json");
try {
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(JSON.stringify({ storageKey: randomBytes(48).toString("base64url"), adminToken: randomBytes(48).toString("base64url") })); await handle.sync(); }
  finally { await handle.close(); }
} catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
const stat = await lstat(file);
if (!stat.isFile() || stat.isSymbolicLink() || !owner(stat)) throw new Error("Unsafe hosted secret file");
const secrets = JSON.parse(await readFile(file, "utf8"));
if (typeof secrets.storageKey !== "string" || secrets.storageKey.length < 32 || typeof secrets.adminToken !== "string" || secrets.adminToken.length < 32)
  throw new Error("Invalid hosted secrets");
const database = new PostgresStorage(process.env.DATABASE_URL);
try {
  await database.initialize();
  // If a local identity record already exists, missing DB state is restoration,
  // never a fresh bootstrap. This protects against accidentally recreating it.
  const record = path.join(directory, "identity.json");
  let previous: { fingerprint: string } | undefined;
  try { previous = JSON.parse(await readFile(record, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const fingerprint = await database.bootstrap(secrets.storageKey, !previous);
  if (previous && previous.fingerprint !== fingerprint) throw new Error("Hosted issuer identity mismatch");
  await writeFile(record, JSON.stringify({ fingerprint }, null, 2) + "\n", { mode: 0o600 });
  const values: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL,
    BLOCKFROST_PROJECT_ID: process.env.BLOCKFROST_PROJECT_ID,
    VEILPASS_ISSUER_STORAGE_KEY: secrets.storageKey,
    VEILPASS_ISSUER_ADMIN_TOKEN: secrets.adminToken,
    VEILPASS_ISSUER_FINGERPRINT: fingerprint,
    VEILPASS_STORAGE: "postgres", VEILPASS_HOSTED_BACKEND: "1",
    VEILPASS_SIGNED_ISSUANCE: "1", VEILPASS_BOOTSTRAP_ISSUER: "0",
    VEILPASS_FRONTEND_ORIGIN: "https://useveilpass.vercel.app",
    NEXT_PUBLIC_HOSTED_PREVIEW: "1", VEILPASS_WORKBENCH: "0",
  };
  // JSON-quoted dotenv values preserve punctuation without shell evaluation.
  await writeFile(path.join(directory, "render.env"), Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ databaseAccessible: true, issuerInitialized: true, publicIssuerFingerprint: fingerprint, privateConfiguration: ".private/hosted-preprod/render.env" }, null, 2));
} finally { await database.close(); }
