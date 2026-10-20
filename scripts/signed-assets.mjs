import { cp, mkdir, readFile } from "node:fs/promises";
const source = "integrations/issuance/managed-authorization",
  target = "apps/web/public/zk-signed";
for (const name of ["authorize", "publishStatus", "deactivate"]) {
  for (const kind of ["prover", "verifier"])
    if (!(await readFile(`${source}/keys/${name}.${kind}`)).length)
      throw new Error("Compile full V3 proof artifacts first");
}
await mkdir(target, { recursive: true });
for (const folder of ["keys", "zkir"])
  await cp(`${source}/${folder}`, `${target}/${folder}`, { recursive: true });
console.log("Prepared public V3 proving assets under /zk-signed.");
