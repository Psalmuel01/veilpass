// Exercises the loopback console boundaries without requesting a deployment.
import assert from 'node:assert/strict';
const sessionUrl=new URL(process.argv[2]||'');
assert.equal(sessionUrl.origin,'http://127.0.0.1:8788');
assert.match(sessionUrl.pathname,/^\/open\/[a-f0-9]{64}$/);
const base=sessionUrl.origin;
let response=await fetch(base+'/state');assert.equal(response.status,403);
response=await fetch(sessionUrl,{redirect:'manual'});assert.equal(response.status,303);
const cookie=response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
response=await fetch(base+'/state',{headers:{cookie}});assert.equal(response.status,200);
const state=await response.json();assert.equal(state.plan.status,'prepared-not-deployed');
assert.equal(state.command,undefined);assert.ok(!JSON.stringify(state).includes('signingKey'));
for(const origin of ['https://untrusted.example','null']){
 response=await fetch(base+'/deploy',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:'{}'});assert.equal(response.status,403);
}
response=await fetch(base+'/reply',{method:'POST',headers:{cookie,origin:base,'content-type':'application/json'},body:JSON.stringify({id:'unknown',value:''})});assert.equal(response.status,409);
response=await fetch(base,{headers:{cookie}});assert.equal(response.status,200);
const html=await response.text(),script=html.match(/<script[^>]*nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];assert.ok(script);new Function(script.replace(/^import .*;$/gm,''));
assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
console.log('PASS: operator private session, origin enforcement, reply binding, CSP and browser-script syntax. No deployment attempted.');
