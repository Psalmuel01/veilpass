import { spawn } from 'node:child_process';
const database = process.env.VEILPASS_TEST_DATABASE_URL;
if (!database || new URL(database).hostname !== '127.0.0.1' || new URL(database).pathname !== '/veilpass') throw Error('Disposable loopback test database required');
const env = { ...process.env, NODE_ENV: 'test', VEILPASS_BUILD_DIR: process.env.VEILPASS_BUILD_DIR || '.next-signed-build',
 VEILPASS_TEST_DATABASE_LOCAL:'1', DATABASE_URL: database,
 VEILPASS_HOSTED_BACKEND:'1', VEILPASS_STORAGE:'postgres', VEILPASS_SIGNED_ISSUANCE:'1',
 VEILPASS_PUBLIC_ORIGIN:'https://acceptance.veilpass.test', VEILPASS_FRONTEND_ORIGIN:'https://useveilpass.vercel.app',
 VEILPASS_ISSUER_STORAGE_KEY:'disposable-test-storage-password-'.repeat(2),
 VEILPASS_ISSUER_ADMIN_TOKEN:'disposable-test-admin-token-'.repeat(2) };
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','127.0.0.1','--port','10000'],{env,stdio:['ignore','ignore','pipe']});
server.stderr.on('data',d=>process.stderr.write(d));
try {
 let ready=false;
 for(let i=0;i<40;i++) { try { if((await fetch('http://127.0.0.1:10000/api/health')).ok) {ready=true;break;} }catch{} await new Promise(r=>setTimeout(r,500)); }
 if(!ready)throw Error('Acceptance server unavailable');
 const child=spawn(process.execPath,['--import','tsx','scripts/hosted-api-check.ts'],{env,stdio:'inherit'});
 const code=await new Promise(resolve=>child.on('exit',resolve));
 if(code!==0)process.exitCode=code||1;
} finally { server.kill('SIGTERM'); await new Promise(resolve=>server.once('exit',resolve)); }
