import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
export function signedProjectRoot(cwd = process.cwd()) {
  const root = [cwd, path.resolve(cwd, "../..")].find((directory) =>
    existsSync(
      path.join(directory, "integrations/issuance/authorization.compact"),
    ),
  );
  if (!root) throw new Error("Signed workspace not found");
  return root;
}
import type { SignedNetworkConfig } from "./signed-midnight";
export async function signedNetworkConfig(): Promise<SignedNetworkConfig> {
  if (process.env.VERCEL || process.env.VEILPASS_SIGNED_NETWORK !== "1")
    throw new Error("Signed network is not configured");
  const { decodeWire } = await import(
    "../../../integrations/issuance/src/wire"
  );
  const c = decodeWire(
    await readFile(
      process.env.VEILPASS_SIGNED_NETWORK_CONFIG ||
        path.join(signedProjectRoot(), ".private/signed-network.json"),
      "utf8",
    ),
  ) as SignedNetworkConfig;
  if (!["undeployed", "preprod"].includes(c.network))
    throw new Error("Invalid network");
  for (const key of ["contractAddress", "domain", "appA", "appB"] as const)
    if (!/^[0-9a-f]{64}$/.test(c[key]))
      throw new Error("Invalid deployment identifier");
  for (const [key, protocols] of [
    ["indexerUri", ["http:", "https:"]],
    ["indexerWsUri", ["ws:", "wss:"]],
    ["proofServer", ["http:", "https:"]],
  ] as const) {
    const url = new URL(c[key]);
    if (
      !(protocols as readonly string[]).includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Public endpoints must not contain access tokens");
  }
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(c.proofServer).hostname,
    )
  )
    throw new Error("Local prover required");
  if (
    typeof c.trust?.publicKey?.x !== "bigint" ||
    typeof c.trust?.publicKey?.y !== "bigint" ||
    !(c.trust?.registryId instanceof Uint8Array) ||
    c.trust.registryId.length !== 32
  )
    throw new Error("Pinned issuer required");
  return c;
}
