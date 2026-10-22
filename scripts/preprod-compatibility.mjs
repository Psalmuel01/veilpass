// Read-only release gate. Never prints authenticated URLs, credentials or schema data.
import './check-node.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { buildClientSchema, parse, validate } from 'graphql';
if (process.argv[2]) process.loadEnvFile(process.argv[2]);
const token = process.env.BLOCKFROST_PROJECT_ID;
if (!token) throw Error('Blockfrost Preprod configuration is required');
const url = new URL('https://midnight-preprod.blockfrost.io/api/v0');
url.searchParams.set('project_id', token);
async function query(query) {
  try {
    const response = await fetch(url, { method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({query}), signal: AbortSignal.timeout(30000), redirect: 'error' });
    if (!response.ok) throw Error();
    const result = await response.json();
    if (result.errors?.length || !result.data) throw Error();
    return result.data;
  } catch { throw Error('Preprod schema check unavailable; no deployment acceptance recorded'); }
}
// Keep wrapper nesting below Blockfrost's query recursion limit of 15.
let ref = 'kind name';
for (let i=0;i<4;i++) ref = `kind name ofType { ${ref} }`;
const input = `name defaultValue type { ${ref} }`;
const schema = buildClientSchema(await query(`{ __schema {
  queryType { name } mutationType { name } subscriptionType { name }
  types { kind name interfaces { kind name } possibleTypes { kind name }
    fields(includeDeprecated:true) { name isDeprecated deprecationReason
      args { ${input} } type { ${ref} } }
    inputFields { ${input} }
    enumValues(includeDeprecated:true) { name isDeprecated deprecationReason }
  }
  directives { name locations args { ${input} } }
} }`));
const source = await readFile(new URL('../node_modules/@midnight-ntwrk/midnight-js-indexer-public-data-provider/dist/index.mjs', import.meta.url), 'utf8');
const documents = [...source.matchAll(/"((?:\\.|[^"\\])*)": \w+Document/g)]
  .map(match => JSON.parse('"'+match[1]+'"'));
if (documents.length < 10) throw Error('Pinned SDK document extraction failed');
const fields = '__typename address state ... on ContractCall { entryPoint }';
documents.push(
  `query VeilPassState($address: HexEncoded!) { block { height hash timestamp } contractAction(address: $address) { ${fields} } }`,
  `query VeilPassAuthorization($offset: TransactionOffset!) { transactions(offset: $offset) { ... on RegularTransaction { raw identifiers transactionResult { status } } contractActions { ${fields} } block { height hash timestamp } } }`,
);
const checks = documents.map(text => {
  const ast = parse(text), operation = ast.definitions[0];
  return {operation:operation.name?.value || 'unnamed', errors:validate(schema,ast).map(e=>e.message)};
});
const head = (await query('{ block { height hash timestamp } }')).block;
const report = {checkedAt:new Date().toISOString(),network:'preprod',midnightJs:'4.1.1',
  schemaCompatible:checks.every(c=>!c.errors.length), indexedHeight:head.height,
  checks, chainSubmission:false, note:'Read-only GraphQL validation, not proof or wallet acceptance.'};
await writeFile('docs/evidence/preprod-compatibility.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if (!report.schemaCompatible) process.exitCode=1;
