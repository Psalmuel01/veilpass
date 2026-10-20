import { readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = "integrations/issuance/managed-authorization";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = {};
for (const name of ["authorize", "publishStatus", "deactivate"]) {
  for (const kind of ["prover", "verifier"]) {
    const file = `${base}/keys/${name}.${kind}`,
      bytes = await readFile(file);
    if (!bytes.length) throw new Error("Incomplete proof artifacts");
    files[`keys/${name}.${kind}`] = {
      bytes: bytes.length,
      sha256: sha(bytes),
      modifiedAt: (await stat(file)).mtime.toISOString(),
    };
  }
}
await writeFile(
  "docs/evidence/signed-artifacts.json",
  JSON.stringify(
    {
      recordedAt: new Date().toISOString(),
      compiler: "0.31.1",
      runtime: "0.16.0",
      qualificationContractSha256: sha(
        await readFile("integrations/issuance/managed/contract/index.js"),
      ),
      generatedContractSha256: sha(await readFile(`${base}/contract/index.js`)),
      sources: {
        qualification: sha(
          await readFile("integrations/issuance/qualification.compact"),
        ),
        authorization: sha(
          await readFile("integrations/issuance/authorization.compact"),
        ),
      },
      files,
      note: "Local artifacts. Transaction confirmations are recorded separately in signed-network.json.",
    },
    null,
    2,
  ) + "\n",
);
console.log("Recorded V3 proving/verifying artifact hashes.");
