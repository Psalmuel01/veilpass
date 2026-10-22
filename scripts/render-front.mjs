import http from 'node:http';
import { preprodGateway } from './preprod-gateway.mjs';
export async function renderFront(port,applicationPort,host='0.0.0.0'){
 if(!['0.0.0.0','127.0.0.1'].includes(host))throw Error('Invalid bind address');
 let gateway;
 const server=http.createServer(async(request,response)=>{
  try{if(await gateway(request,response))return;}catch{response.writeHead(503);response.end('Service unavailable');return;}
  const upstream=http.request({host:'127.0.0.1',port:applicationPort,path:request.url,method:request.method,headers:request.headers},incoming=>{
   response.writeHead(incoming.statusCode??502,incoming.headers);incoming.pipe(response);
  });
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end('Service starting');});
  request.on('aborted',()=>upstream.destroy());response.on('close',()=>upstream.destroy());request.pipe(upstream);
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 gateway=await preprodGateway(server);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});return server;
}
