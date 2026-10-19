import { chromium, expect, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { DAppConnectorWalletAdapter, type MidnightWalletProvider, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import type { Challenge } from '../packages/sdk/index';
import type { SampleBatch } from '../packages/lifecycle/sample';
export async function liveBrowserAuthorization(wallet: MidnightWalletProvider, config: EnvironmentConfiguration, address:string, batch:SampleBatch, interactive=false) {
  const recording=process.env.VEILPASS_RECORD_V2==='1';
  const filmDirectory=path.resolve('.cache/video-v2');if(recording)await mkdir(filmDirectory,{recursive:true});
  const filmStarted=Date.now();const filmScenes:{name:string;seconds:number}[]=[];let filmPage:Page|undefined;let closed=false;
  const scene=async(name:string,hold=0)=>{if(!recording)return;filmScenes.push({name,seconds:(Date.now()-filmStarted)/1000});if(hold)await new Promise(r=>setTimeout(r,hold));};
  const directory=path.resolve('.private','live-browser-e2e',String(process.pid));await mkdir(directory,{recursive:true,mode:0o700});
  const configFile=path.join(directory,'deployment.json');
  await writeFile(configFile,JSON.stringify({network:config.networkId,contractAddress:address,root:batch.qualified.root,domain:batch.domain,appA:batch.appA,appB:batch.appB,indexerUri:config.indexer,indexerWsUri:config.indexerWS,proofServer:config.proofServer}),{mode:0o600});
  const port=process.env.VEILPASS_LIVE_PORT || (recording?'3007':'3006');
  const origin='http://127.0.0.1:'+port;
  const log=createWriteStream('.cache/live-browser-next.log');
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','127.0.0.1','--port',port],{env:{...process.env,VEILPASS_LIVE_CONFIG:configFile,VEILPASS_BUILD_DIR:process.env.VEILPASS_BUILD_DIR || '.next-live-demo'},stdio:['ignore','pipe','pipe']});server.stdout.pipe(log);server.stderr.pipe(log);
  const browser=await chromium.launch({channel:'chrome',headless:!interactive}).catch(async error=>{server.kill('SIGTERM');log.end();await rm(directory,{recursive:true,force:true});throw error;});
  const close=async()=>{if(closed)return;closed=true;const video=filmPage?.video();if(recording && filmPage)await filmPage.context().close();if(recording && video){await video.saveAs(path.join(filmDirectory,'live-raw.webm'));await writeFile(path.join(filmDirectory,'live-scenes.json'),JSON.stringify({scenes:filmScenes,durationSeconds:(Date.now()-filmStarted)/1000},null,2));}await browser.close();server.kill('SIGTERM');log.end();await rm(directory,{recursive:true,force:true});};
  try {
    let ready=false;for(let i=0;i<120;i++){try{const response=await fetch(`${origin}/api/live`);if(response.ok && (await response.json()).contractAddress===address){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw new Error('Live browser server did not start');
    const page=filmPage=await browser.newPage({viewport:recording?{width:1600,height:900}:{width:1440,height:1100},colorScheme:'dark',reducedMotion:interactive?'no-preference':'reduce',...(recording?{recordVideo:{dir:filmDirectory,size:{width:1600,height:900}}}:{})});
    if(recording)filmScenes.push({name:'video-origin',seconds:(Date.now()-filmStarted)/1000});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const adapter=new DAppConnectorWalletAdapter(wallet,config);
    let simulateNetworkChange=false;
    page.on('request',request=>{if(request.url().includes('/api/live') && request.postData()?.includes(batch.qualified.credential.holderSecret)) errors.push('Credential leaked to verifier API');});
    await page.exposeFunction('veilpassWalletCall',async(method:string,args:unknown[])=>{switch(method){case 'getConfiguration':{const actual=await adapter.getConfiguration();return simulateNetworkChange?{...actual,networkId:'preprod'}:actual;}case 'getShieldedAddresses':return adapter.getShieldedAddresses();case 'balanceUnsealedTransaction':return adapter.balanceUnsealedTransaction(String(args[0]));case 'submitTransaction':return adapter.submitTransaction(String(args[0]));default:throw new Error('Unsupported wallet method');}});
    await page.addInitScript(`const connected={};for(const method of ['getConfiguration','getShieldedAddresses','balanceUnsealedTransaction','submitTransaction'])connected[method]=(...args)=>window.veilpassWalletCall(method,args);window.midnight={local:{name:'Funded local test wallet',apiVersion:'4.0.1',connect:async network=>{if(network!=='undeployed')throw new Error('Local test wallet only');return connected;}}};`);
    await page.goto(`${origin}/live`);
    await page.getByLabel('Credential JSON').fill(JSON.stringify(batch.qualified));
    await page.getByRole('button',{name:'Load qualification',exact:true}).click();
    await expect(page.getByText('Qualification loaded · Level 2')).toBeVisible();
    await page.getByRole('button',{name:'Find Midnight wallets'}).click();
    await page.getByRole('button',{name:'Funded local test wallet',exact:true}).click();
    await expect(page.getByText('Funded local test wallet connected')).toBeVisible();
    if(recording){await page.evaluate(()=>{const cursor=document.createElement('div');cursor.id='veilpass-film-cursor';cursor.style.cssText='position:fixed;left:-60px;top:-60px;width:22px;height:22px;border-radius:50%;background:#9bb2ff66;border:2px solid #d9e2ff;pointer-events:none;z-index:99999;box-shadow:0 0 0 6px #3155e730;transition:left .12s ease,top .12s ease';document.body.appendChild(cursor);addEventListener('mousemove',e=>{cursor.style.left=e.clientX-11+'px';cursor.style.top=e.clientY-11+'px';});});await page.locator('.vp-live-grid').scrollIntoViewIfNeeded();await scene('live-ready',7000);}
    if(interactive) {
      console.log('Live V2 demo ready in Chrome at '+origin+'/live');
      console.log('A real funded LOCAL test wallet is connected. Choose either policy, request a challenge, generate a proof, then verify. No Preprod funds are used.');
      console.log('Close this Chrome window to stop the demo and dispose the local chain.');
      await new Promise<void>(resolve=>browser.once('disconnected',()=>resolve()));
      await close();
      return {challenges:[] as Challenge[],evidence:{interactive:true,twoPoliciesConfirmed:false,sdkReplayRejected:false,transactionIds:[] as string[],connector:'Funded local testkit wallet'},close,checkRevoked:async()=>{}};
    }
    await mkdir('docs/screenshots/live',{recursive:true});
    const capture=async(name:string,width=1440)=>{await page.setViewportSize({width,height:width<500?844:1100});await page.evaluate(async()=>{await document.fonts.ready;document.documentElement.style.scrollBehavior='auto';scrollTo({top:0,left:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Live page overflow at '+width);await page.screenshot({path:'docs/screenshots/live/'+name+'.png',fullPage:true});};
    const txIds:string[]=[];const challenges:Challenge[]=[];
    for(const policy of ['approved-training','professional-level']) {
      await page.getByLabel('Application policy').selectOption(policy);
      if(recording){await page.getByLabel('Application policy').scrollIntoViewIfNeeded();await scene(policy+'-request',5000);}
      const challengeResponse=page.waitForResponse(response=>response.url()===origin+'/api/live' && response.request().postDataJSON()?.action==='challenge');
      await page.getByRole('button',{name:'Request live challenge',exact:true}).click();
      challenges.push((await (await challengeResponse).json()).result);
      await expect(page.getByRole('button',{name:'Generate and submit proof',exact:true})).toBeEnabled();
      if(policy==='approved-training' && !recording) {simulateNetworkChange=true;await page.getByRole('button',{name:'Generate and submit proof',exact:true}).click();await expect(page.locator('.vp-alert-error')).toContainText('Wallet network changed');simulateNetworkChange=false;}
      console.log(`Browser: generating real ${policy} proof...`);
      await scene(policy+'-proof-start');
      await page.getByRole('button',{name:'Generate and submit proof',exact:true}).click();
      await Promise.race([page.getByText(/Transaction confirmed at block/).waitFor({timeout:300000}),page.locator('.vp-alert-error').waitFor({timeout:300000}).then(async()=>{throw new Error(await page.locator('.vp-alert-error').innerText());})]);
      await scene(policy+'-confirmed',5000);
      await page.getByRole('button',{name:'Verify confirmed authorization'}).click();
      await expect(page.getByRole('heading',{name:'Eligibility confirmed on Midnight'})).toBeVisible({timeout:30000});
      const receipt=JSON.parse(await page.locator('.vp-verified-result pre').innerText());if(receipt.mode!=='confirmed-midnight')throw new Error('Wrong browser verification mode');txIds.push(receipt.verificationReference);
      if(recording){await page.locator('.vp-verified-result').scrollIntoViewIfNeeded();await scene(policy+'-verified',10000);}
      if(policy==='professional-level' && !recording){await capture('confirmed-desktop');await capture('confirmed-mobile',390);await page.setViewportSize({width:1440,height:1100});}
      await page.getByRole('button',{name:'Verify confirmed authorization'}).click();
      await expect(page.locator('.vp-alert-error')).toContainText('Challenge already consumed');
      if(recording){await page.locator('.vp-alert-error').scrollIntoViewIfNeeded();await scene(policy+'-replay',6000);}
    }
    if(!recording){await capture('replay-rejected-desktop');await capture('replay-rejected-mobile',390);}
    await scene('awaiting-issuer-revocation');
    return {challenges,evidence:{twoPoliciesConfirmed:true,sdkReplayRejected:true,transactionIds:txIds,connector:'Funded testkit wallet through connector bridge, not an installed extension'},close,checkRevoked:async()=>{try {await scene('issuer-revocation-confirmed',3000);await page.getByRole('button',{name:'Verify confirmed authorization'}).click();await expect(page.locator('.vp-alert-error')).toContainText('Credential status changed');if(recording){await page.locator('.vp-alert-error').scrollIntoViewIfNeeded();await scene('revoked-receipt',10000);await page.getByRole('button',{name:'Request live challenge',exact:true}).click();await expect(page.getByRole('button',{name:'Generate and submit proof',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Generate and submit proof',exact:true}).click();await expect(page.locator('.vp-alert-error')).toContainText('Credential is revoked');await scene('revoked-fresh-proof',10000);}if(errors.length)throw new Error(`Browser runtime errors: ${errors.join('; ')}`);console.log('Live V2 browser passed: two real proofs, SDK confirmations, replay and revocation rejection.');}finally{await close();}}};
  }catch(e){await close();throw e;}
}
