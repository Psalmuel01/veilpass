import './check-node.mjs';
import http from 'node:http';
import {readFile,writeFile}from'node:fs/promises';
import {parseEnv}from'node:util';
import {WebSocket}from'ws';
import assert from 'node:assert/strict';
import {preprodGateway}from'./preprod-gateway.mjs';
import {gatewayDocuments}from'./preprod-gateway-policy.mjs';
const env=parseEnv(await readFile(process.argv[2],'utf8')),config=JSON.parse(await readFile('deploy/preprod/network.json','utf8'));
let handler;const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});
handler=await preprodGateway(server,{...env,VEILPASS_SIGNED_NETWORK:'1',VEILPASS_PUBLIC_ORIGIN:'https://veilpass-preprod.onrender.com',VEILPASS_FRONTEND_ORIGIN:'https://useveilpass.vercel.app'});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,docs=await gatewayDocuments(),query=[...docs.keys()].find(q=>q.includes('query CONTRACT_STATE_QUERY'));
const post=(query,address=config.contractAddress,origin='https://useveilpass.vercel.app')=>fetch(`http://127.0.0.1:${port}/api/preprod/indexer`,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({query,variables:{address}}),signal:AbortSignal.timeout(20000)});
try{
 const response=await post(query);assert.equal(response.status,200);const text=await response.text();assert(!text.includes(env.BLOCKFROST_PROJECT_ID));assert(JSON.parse(text).data.contractAction.state);
 assert.equal((await post(query,'0'.repeat(64))).status,400);assert.equal((await post(query,config.contractAddress,'https://untrusted.example')).status,403);assert.equal((await post('{__schema{queryType{name}}}')).status,400);
 const subscription=[...docs.keys()].find(q=>q.includes('subscription CONTRACT_STATE_SUB'));
 await new Promise((resolve,reject)=>{const socket=new WebSocket(`ws://127.0.0.1:${port}/api/preprod/indexer/ws`,'graphql-transport-ws',{origin:'https://useveilpass.vercel.app'});let complete=false;const timer=setTimeout(()=>{socket.terminate();reject(Error('Gateway subscription timed out'));},25000);socket.on('error',()=>reject(Error('Gateway subscription unavailable')));socket.on('open',()=>socket.send(JSON.stringify({type:'connection_init'})));socket.on('message',raw=>{if(complete)return;try{const m=JSON.parse(raw.toString());assert(!raw.toString().includes(env.BLOCKFROST_PROJECT_ID));if(m.type==='connection_ack')socket.send(JSON.stringify({id:'acceptance',type:'subscribe',payload:{query:subscription,variables:{address:config.contractAddress}}}));if(m.type==='next'){assert(m.payload.data.contractActions.state);complete=true;clearTimeout(timer);socket.close();resolve();}if(m.type==='error')throw Error();}catch{complete=true;clearTimeout(timer);socket.close();reject(Error('Gateway subscription rejected'));}});});
 const result={checkedAt:new Date().toISOString(),network:'preprod',contractAddress:config.contractAddress,httpReadPassed:true,websocketReadPassed:true,wrongContractRejected:true,untrustedOriginRejected:true,introspectionRejected:true,tokenAbsentFromResponses:true,chainSubmission:false,publicHostedGateway:false,note:'Real Blockfrost reads through the local instance of the deployment gateway; public hosted acceptance is separate.'};await writeFile('docs/evidence/preprod-gateway.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
