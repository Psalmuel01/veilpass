// Read-only check of actual graphql-transport-ws delivery. No wallet or mutation.
import './check-node.mjs';
import { WebSocket } from 'ws';
import { writeFile } from 'node:fs/promises';
if(process.argv[2]) process.loadEnvFile(process.argv[2]);
const token=process.env.BLOCKFROST_PROJECT_ID;
if(!token)throw Error('Existing Preprod Blockfrost project required');
const url=new URL('wss://midnight-preprod.blockfrost.io/api/v0/ws');url.searchParams.set('project_id',token);
const report=await new Promise((resolve,reject)=>{
 const socket=new WebSocket(url,'graphql-transport-ws',{maxPayload:1048576,handshakeTimeout:15000});
 const fail=()=>{clearTimeout(timer);socket.terminate();reject(Error('Preprod subscription delivery failed; no deployment accepted'));};
 const timer=setTimeout(fail,30000);
 socket.on('error',fail);
 socket.on('open',()=>socket.send(JSON.stringify({type:'connection_init'})));
 socket.on('message',raw=>{
  try{
   const message=JSON.parse(raw.toString());
   if(message.type==='connection_ack')socket.send(JSON.stringify({id:'head',type:'subscribe',payload:{query:'subscription { blocks { height } }'}}));
   else if(message.type==='ping')socket.send(JSON.stringify({type:'pong'}));
   else if(message.type==='next'){
    const height=message.payload?.data?.blocks?.height;
    if(!Number.isSafeInteger(height)||height<=0)return fail();
    clearTimeout(timer);socket.send(JSON.stringify({id:'head',type:'complete'}));socket.close(1000);
    resolve({checkedAt:new Date().toISOString(),network:'preprod',protocol:'graphql-transport-ws',subscriptionDelivered:true,indexedHeight:height,chainSubmission:false});
   }else if(message.type==='error')fail();
  }catch{fail();}
 });
 socket.on('close',()=>{clearTimeout(timer);reject(Error('Preprod subscription closed before acceptance'));});
});
await writeFile('docs/evidence/preprod-subscription.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
