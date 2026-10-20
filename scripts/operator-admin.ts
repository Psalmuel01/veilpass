// Offline database administration; never expose this script as a public API.
import { readFile, mkdir, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { operatorStorage } from "../integrations/issuance/src/operator-storage.js";
import { operatorToken, operatorId, operatorRole } from "../integrations/issuance/src/operators.js";
const [envFile, action, id, role = "issuer", daysText = "90"] = process.argv.slice(2);
if (!envFile || !["list", "create", "rotate", "disable"].includes(action))
  throw new Error("Usage: operator-admin <private-env-file> list|create|rotate|disable [id] [issuer|revoker|administrator] [days]");
const env = parseEnv(await readFile(envFile, "utf8"));
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required in the private environment file");
const db = operatorStorage({ ...env, VEILPASS_DATABASE_TRANSPORT: process.env.VEILPASS_DATABASE_TRANSPORT || env.VEILPASS_DATABASE_TRANSPORT || "" });
try {
  await db.initialize();
  if (action === "list") console.log(JSON.stringify(await db.operators(), null, 2));
  else if (action === "disable") { await db.disableOperator(operatorId(id)); console.log("Operator disabled immediately."); }
  else {
    operatorId(id); operatorRole(role);
    const days = Number(daysText);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Expiry must be 1–365 days");
    // Write exclusively before committing the credential, so a filesystem failure
    // cannot strand the operator after rotation. File names never contain secrets.
    const token = operatorToken();
    const directory = path.resolve(".private/hosted-preprod/operators");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
        (process.getuid && stat.uid !== process.getuid())) throw new Error("Operator directory must be owner-only");
    const target = path.join(directory, `${id}-${Date.now()}.json`);
    await writeFile(target, JSON.stringify({ id, role, token }, null, 2), { mode: 0o600, flag: "wx" });
    await db.provisionOperator(id, role, token, Date.now() + days * 86400000, action === "rotate");
    console.log(`Operator ${action} completed. Private credential saved to ${target}. Never commit or paste it into chat.`);
  }
} finally { await db.close(); }
