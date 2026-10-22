import {expect,it} from 'vitest';
import {gatewayDocuments,validateGatewayOperation} from '../scripts/preprod-gateway-policy.mjs';
const address='a'.repeat(64);
it('permits pinned SDK reads scoped to the deployed contract, rejecting altered queries and other contracts',async()=>{
 const docs=await gatewayDocuments();const query=[...docs.keys()].find(q=>q.includes('query CONTRACT_STATE_QUERY'))!;
 expect(validateGatewayOperation({query,variables:{address}},docs,address,'http').variables.address).toBe(address);
 expect(()=>validateGatewayOperation({query,variables:{address:'b'.repeat(64)}},docs,address,'http')).toThrow('Contract rejected');
 expect(()=>validateGatewayOperation({query:query.replace('state','state __typename'),variables:{address}},docs,address,'http')).toThrow();
 expect(()=>validateGatewayOperation({query,variables:{address,url:'https://example.com'}},docs,address,'http')).toThrow();
 expect(()=>validateGatewayOperation({query:'{ __schema { queryType { name } } }'},docs,address,'http')).toThrow();
 expect(()=>validateGatewayOperation({query:'mutation { disconnect }'},docs,address,'ws')).toThrow();
});
it('rejects malformed offsets and subscriptions over HTTP',async()=>{
 const docs=await gatewayDocuments();const query=[...docs.keys()].find(q=>q.includes('query BLOCK_HASH_QUERY'))!;
 expect(()=>validateGatewayOperation({query,variables:{offset:{height:-1}}},docs,address,'http')).toThrow();
 expect(()=>validateGatewayOperation({query,variables:{offset:{height:1,hash:'a'.repeat(64)}}},docs,address,'http')).toThrow();
 const subscription=[...docs.keys()].find(q=>q.includes('subscription CONTRACT_STATE_SUB'))!;
 expect(()=>validateGatewayOperation({query:subscription,variables:{address}},docs,address,'http')).toThrow();
 expect(validateGatewayOperation({query:subscription,variables:{address}},docs,address,'ws')).toBeTruthy();
});

it('bounds broad transaction subscriptions to the confirmed deployment history',async()=>{
 const docs=await gatewayDocuments();const query=[...docs.keys()].find(q=>q.includes('subscription TXS_FROM_BLOCK_SUB'))!;
 expect(()=>validateGatewayOperation({query,variables:{}},docs,address,'ws',100)).toThrow();
 expect(()=>validateGatewayOperation({query,variables:{offset:{height:99}}},docs,address,'ws',100)).toThrow();
 expect(validateGatewayOperation({query,variables:{offset:{height:100}}},docs,address,'ws',100)).toBeTruthy();
});
