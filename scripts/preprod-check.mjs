// Read-only endpoint check. Never prints URLs containing access tokens.
import "./check-node.mjs";
if (process.argv[2]) process.loadEnvFile(process.argv[2]);
const token = process.env.BLOCKFROST_PROJECT_ID;
if (!token)
  throw new Error(
    "Set BLOCKFROST_PROJECT_ID in an ignored local environment file. See docs/PREPROD_SETUP.md.",
  );
const rpc = new URL("https://rpc.midnight-preprod.blockfrost.io");
rpc.searchParams.set("project_id", token);
const indexer = new URL("https://midnight-preprod.blockfrost.io/api/v0");
indexer.searchParams.set("project_id", token);
async function post(url, body) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error || data.errors)
      throw new Error("Provider rejected the query");
    return data;
  } catch {
    throw new Error(
      "Preprod provider check failed. Check project network, token and connectivity.",
    );
  }
}
const results = await Promise.all([
  post(rpc, { jsonrpc: "2.0", id: 1, method: "system_version", params: [] }),
  post(indexer, { query: "{ block { height hash timestamp } }" }),
]);
if (!results[0].result || !results[1].data?.block)
  throw new Error("Unexpected Preprod provider response");
console.log(
  JSON.stringify(
    {
      network: "preprod",
      rpcAccessible: true,
      indexerAccessible: true,
      nodeVersion: results[0].result,
      indexedHeight: results[1].data.block.height,
      note: "Connectivity only. Ledger, compiler, indexer schema and wallet compatibility must be checked before deployment.",
    },
    null,
    2,
  ),
);
