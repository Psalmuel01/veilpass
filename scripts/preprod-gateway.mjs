import { preprodNetworkEnabled } from '../packages/network/preprod-enabled.mjs';
import { WebSocket, WebSocketServer } from 'ws';
import { gatewayDocuments, validateGatewayOperation } from './preprod-gateway-policy.mjs';
import { readFile } from 'node:fs/promises';
export async function preprodGateway(server,env=process.env){
 const config=JSON.parse(await readFile('deploy/preprod/network.json','utf8'));
 const address=config.contractAddress,documents=await gatewayDocuments();
 const enabled=()=>preprodNetworkEnabled(env)&&!!env.BLOCKFROST_PROJECT_ID;
 const origins=new Set([env.VEILPASS_PUBLIC_ORIGIN,env.VEILPASS_FRONTEND_ORIGIN].filter(Boolean));
 const buckets=new Map();let active=0;
 const admit=(key)=>{const now=Date.now(),slot=buckets.get(key);if(buckets.size>4096){for(const [k,v]of buckets)if(v.until<now)buckets.delete(k);if(buckets.size>4096)return false;}if(!slot||slot.until<now){buckets.set(key,{count:1,until:now+60000});return true;}return ++slot.count<=60;};
 const endpoint=(ws=false)=>{const u=new URL(ws?'wss://midnight-preprod.blockfrost.io/api/v0/ws':'https://midnight-preprod.blockfrost.io/api/v0');u.searchParams.set('project_id',env.BLOCKFROST_PROJECT_ID);return u;};
 const allowedOrigin=(request)=>!request.headers.origin||origins.has(request.headers.origin);
 const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
 function cors(request){return origins.has(request.headers.origin)?{'access-control-allow-origin':request.headers.origin,'vary':'Origin'}:{};}
 async function http(request,response){
  if(request.url!=='/api/preprod/indexer')return false;
  const reply=(status,data)=>{response.writeHead(status,{...headers,...cors(request)});response.end(JSON.stringify(data));};
  if(!enabled()){reply(503,{error:'Preprod network unavailable'});return true;}
  if(!allowedOrigin(request)){reply(403,{error:'Origin rejected'});return true;}
  if(request.method==='OPTIONS'){response.writeHead(204,{...cors(request),'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type'});response.end();return true;}
  if(request.method!=='POST'||!request.headers['content-type']?.startsWith('application/json')){reply(405,{error:'JSON POST required'});return true;}
  if(!admit(request.socket.remoteAddress??'unknown')||!admit('global')){reply(429,{error:'Request limit reached'});return true;}
  try{
   let length=0;const chunks=[];
   for await(const chunk of request){length+=chunk.length;if(length>32768)throw Error();chunks.push(chunk);}
   const payload=validateGatewayOperation(JSON.parse(Buffer.concat(chunks).toString()),documents,address,'http',config.deploymentHeight);
   const upstream=await fetch(endpoint(),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!upstream.ok)throw Error();
   const result=await upstream.json();
   reply(200,result.errors?{errors:[{message:'Indexer operation failed'}]}:{data:result.data});
  }catch{reply(400,{error:'Preprod indexer request rejected'});}return true;
 }
 const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
 server.on('upgrade',(request,socket,head)=>{
  if(request.url!=='/api/preprod/indexer/ws'||!enabled()||!allowedOrigin(request)||active>=8||!admit(request.socket.remoteAddress??'unknown')||!admit('global')){socket.destroy();return;}
  wss.handleUpgrade(request,socket,head,client=>{
   active++;let initialized=false,transferred=0;const ids=new Set();
   const upstream=new WebSocket(endpoint(true),'graphql-transport-ws',{maxPayload:16777216,perMessageDeflate:false,handshakeTimeout:10000});
   const lifetime=setTimeout(()=>client.close(1000,'Reconnect to continue'),600000);
   const fail=()=>{client.close(1011,'Indexer unavailable');upstream.close();};
   client.on('message',raw=>{
    try{
     const m=JSON.parse(raw.toString());
     if(m.type==='connection_init'){
      if(initialized||m.payload&&Object.keys(m.payload).length)throw Error();initialized=true;
      const init=()=>upstream.send(JSON.stringify({type:'connection_init'}));if(upstream.readyState===WebSocket.OPEN)init();else upstream.once('open',init);
     }else if(m.type==='ping'){client.send(JSON.stringify({type:'pong'}));}
     else if(m.type==='pong'){}
     else if(m.type==='subscribe'){
      if(!initialized||upstream.readyState!==WebSocket.OPEN||typeof m.id!=='string'||m.id.length>64||ids.has(m.id)||ids.size>=4||!admit('global'))throw Error();
      const payload=validateGatewayOperation(m.payload,documents,address,'ws',config.deploymentHeight);ids.add(m.id);upstream.send(JSON.stringify({id:m.id,type:'subscribe',payload}));
     }else if(m.type==='complete'&&ids.delete(m.id))upstream.send(JSON.stringify({id:m.id,type:'complete'}));else throw Error();
    }catch{client.close(4400,'Operation rejected');}
   });
   upstream.on('message',raw=>{try{transferred+=raw.length;if(transferred>67108864)return fail();const m=JSON.parse(raw.toString());if(m.type==='ping'){upstream.send(JSON.stringify({type:'pong'}));return;}if(m.type==='pong')return;if(m.type==='error')m.payload=[{message:'Indexer operation failed'}];if(m.payload?.errors)m.payload={errors:[{message:'Indexer operation failed'}]};if(m.type==='complete')ids.delete(m.id);if(client.readyState===WebSocket.OPEN){if(client.bufferedAmount>4194304)return fail();client.send(JSON.stringify(m));}}catch{fail();}});
   upstream.on('error',fail);upstream.on('close',()=>client.close());client.on('error',()=>upstream.close());
   client.on('close',()=>{clearTimeout(lifetime);active--;upstream.close();});
  });
 });
 return http;
}
