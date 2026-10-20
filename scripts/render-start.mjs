import "./check-node.mjs";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, lstat, access } from "node:fs/promises";
import path from "node:path";
process.umask(0o077);
if (process.env.VERCEL) throw new Error("Persistent backend cannot run on Vercel");
const port = process.env.PORT || "10000";
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw new Error("Invalid service port");
const data = process.env.VEILPASS_DATA_DIRECTORY ||
  (process.env.VEILPASS_STORAGE === "postgres" ? "/tmp/veilpass" : "/var/data/veilpass");
if (!path.isAbsolute(data)) throw new Error("Persistent directory must be absolute");
await mkdir(data, { recursive: true, mode: 0o700 });
const stat = await lstat(data);
if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077))
  throw new Error("Persistent directory must be owner-only");
await access(data, 2);
if (process.env.VEILPASS_HOSTED_BACKEND === "1") {
  process.env.VEILPASS_PUBLIC_ORIGIN ||= process.env.RENDER_EXTERNAL_URL;
  execFileSync(process.execPath, ["--import", "tsx", "scripts/render-preflight.ts"], {
    stdio: "inherit", env: { ...process.env, VEILPASS_DATA_DIRECTORY: data },
  });
}
// Serving the configured application is separate from enabling hosted issuance,
// network verification or remote proving. Their explicit gates remain enforced.
const child = spawn(process.execPath, [
  "node_modules/next/dist/bin/next", "start", "apps/web",
  "--hostname", "0.0.0.0", "--port", port,
], { stdio: "inherit", env: {
  ...process.env,
  VEILPASS_ISSUER_DIRECTORY: path.join(data, "issuer"),
  VEILPASS_VERIFIER_DIRECTORY: path.join(data, "verifiers"),
} });
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Service could not start"); process.exit(1); });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
