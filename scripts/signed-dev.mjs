import { mkdir, lstat, open, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import "./check-node.mjs";
const directory = path.resolve(".private/signed-issuer");
await mkdir(directory, { recursive: true, mode: 0o700 });
const parent = await lstat(directory);
if (!parent.isDirectory() || parent.isSymbolicLink() || parent.mode & 0o077)
  throw new Error("Issuer directory must be owner-only");
const file = path.join(directory, "service-secrets.json");
try {
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(
      JSON.stringify({
        storageKey: randomBytes(48).toString("base64url"),
        adminToken: randomBytes(48).toString("base64url"),
      }),
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
const stat = await lstat(file);
if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077)
  throw new Error("Issuer secrets must be owner-only");
const secrets = JSON.parse(await readFile(file, "utf8"));
if (secrets.storageKey?.length < 32 || secrets.adminToken?.length < 32)
  throw new Error("Invalid service secrets");
if (process.argv.includes("--token")) {
  console.log(secrets.adminToken);
  process.exit(0);
}
execFileSync(process.execPath, ["integrations/issuance/compile.mjs"], {
  stdio: "inherit",
});
console.log("Signed issuance: http://127.0.0.1:3018/holder and /issuer");
console.log(
  "Operator token: run npm run issuer:token in another terminal. Back up the owner-only .private/signed-issuer directory.",
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3018",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VEILPASS_BUILD_DIR: ".next-signed-dev",
      VEILPASS_SIGNED_ISSUANCE: "1",
      VEILPASS_ISSUER_DIRECTORY: directory,
      VEILPASS_ISSUER_STORAGE_KEY: secrets.storageKey,
      VEILPASS_ISSUER_ADMIN_TOKEN: secrets.adminToken,
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
