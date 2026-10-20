import { bootstrapIssuer } from "../integrations/issuance/src/bootstrap.js";
import { hostedServiceConfigured } from "../apps/web/lib/service-access.js";
import path from "node:path";

if (!hostedServiceConfigured()) throw new Error("Invalid hosted-service configuration");
if (process.env.RENDER_SERVICE_TYPE && process.env.VEILPASS_STORAGE !== "postgres")
  throw new Error("This Render release requires external Postgres; ephemeral SQLite is not supported");
for (const name of ["VEILPASS_ISSUER_STORAGE_KEY", "VEILPASS_ISSUER_ADMIN_TOKEN"]) {
  const value = process.env[name];
  if (!value || value.length < 32 || value.length > 1024)
    throw new Error("Missing or invalid hosted-service secret");
}
if (process.env.VEILPASS_STORAGE === "postgres") {
  const { hostedDatabase } = await import("../integrations/issuance/src/postgres.js");
  const db = hostedDatabase();
  try {
    await db.initialize();
    const fingerprint = await db.bootstrap(process.env.VEILPASS_ISSUER_STORAGE_KEY!, process.env.VEILPASS_BOOTSTRAP_ISSUER === "1");
    if (process.env.VEILPASS_ISSUER_FINGERPRINT && process.env.VEILPASS_ISSUER_FINGERPRINT !== fingerprint)
      throw new Error("Configured issuer fingerprint mismatch");
    console.log(`Public issuer fingerprint: ${fingerprint}`);
  } finally { await db.close(); }
} else {
  await bootstrapIssuer(
    path.join(process.env.VEILPASS_DATA_DIRECTORY!, "issuer"),
    process.env.VEILPASS_ISSUER_STORAGE_KEY!,
    process.env.VEILPASS_BOOTSTRAP_ISSUER === "1",
  );
}
console.log("Persistent issuer identity verified.");
