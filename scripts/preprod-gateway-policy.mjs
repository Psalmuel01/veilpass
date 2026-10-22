import { parse, print, Kind } from 'graphql';
import { readFile } from 'node:fs/promises';
// Accept exactly the read-only operation documents shipped by our pinned SDK.
// Names alone are insufficient: the complete normalized AST must match.
export async function gatewayDocuments() {
  const source=await readFile(new URL('../node_modules/@midnight-ntwrk/midnight-js-indexer-public-data-provider/dist/index.mjs',import.meta.url),'utf8');
  const documents=[...source.matchAll(/"((?:\\.|[^"\\])*)": \w+Document/g)].map(m=>JSON.parse('"'+m[1]+'"'));
  if(documents.length!==12)throw Error('Pinned indexer documents changed');
  return new Map(documents.map(query=>{const ast=parse(query);return [print(ast),ast.definitions[0]];}));
}
export function validateGatewayOperation(payload,documents,address,transport,minimumHeight=0) {
  if(!payload||typeof payload.query!=='string'||payload.query.length>24000||payload.extensions)throw Error('Operation rejected');
  const ast=parse(payload.query),canonical=print(ast),op=documents.get(canonical);
  if(!op||op.kind!==Kind.OPERATION_DEFINITION||!['query','subscription'].includes(op.operation)||
    (transport==='http'&&op.operation!=='query')||(payload.operationName&&payload.operationName!==op.name?.value))throw Error('Operation rejected');
  const vars=payload.variables??{};
  if(!vars||typeof vars!=='object'||Array.isArray(vars))throw Error('Variables rejected');
  const allowed=new Set((op.variableDefinitions??[]).map(v=>v.variable.name.value));
  if(Object.keys(vars).some(k=>!allowed.has(k)))throw Error('Variables rejected');
  if(allowed.has('address')&&vars.address!==address)throw Error('Contract rejected');
  if(vars.offset!=null){
    const offset=vars.offset;
    if(typeof offset!=='object'||Array.isArray(offset)||Object.keys(offset).length!==1)throw Error('Offset rejected');
    const [key,value]=Object.entries(offset)[0];
    if(key==='height'?!Number.isSafeInteger(value)||value<0:!['hash','identifier','transactionId'].includes(key)||typeof value!=='string'||!/^[a-f0-9]{64,128}$/i.test(value))throw Error('Offset rejected');
  }
  if(op.name?.value==='TXS_FROM_BLOCK_SUB'&&(!Number.isSafeInteger(vars.offset?.height)||vars.offset.height<minimumHeight))throw Error('Subscription history rejected');
  return {query:payload.query,variables:vars,...(payload.operationName?{operationName:payload.operationName}:{})};
}
