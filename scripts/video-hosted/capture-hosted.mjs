// User-requested scripted demonstration, using the same isolated browser-recording
// approach as the previous film, now against the live deployed service.
// No real person's vault, wallet, recovery phrase or educational record is used.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const dir=path.resolve('.cache/video-hosted');await mkdir(dir,{recursive:true});
const origin='https://useveilpass.vercel.app';
const env=parseEnv(await readFile('.private/hosted-preprod/render.env','utf8'));
const passphrase='Disposable filmed vault '+randomBytes(24).toString('hex');
const token=env.VEILPASS_ISSUER_ADMIN_TOKEN;
if(!token)throw Error('Private operator configuration missing');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},colorScheme:'dark',reducedMotion:'reduce',acceptDownloads:true,recordVideo:{dir,size:{width:1600,height:900}}});
const page=await context.newPage();const marks=[];const started=Date.now();let id;let revoked=false;let backupFile;
const mark=async(name,hold=3500)=>{marks.push({name,seconds:(Date.now()-started)/1000});console.log(name);if(hold)await page.waitForTimeout(hold);};
async function operator(body){
 const response=await fetch(origin+'/api/issuance',{method:'POST',redirect:'error',signal:AbortSignal.timeout(65000),headers:{origin,'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)});
 if(!response.ok)throw Error(`Hosted operator HTTP ${response.status}`);
 return response.text();
}
async function frame(name){await page.screenshot({path:path.join(dir,name+'.png')});}
try{
 await mark('video-origin',0);await page.goto(origin,{waitUntil:'networkidle'});await mark('homepage',7000);await frame('home-ui');
 await page.getByRole('link',{name:'Open app',exact:true}).click();await page.locator('#holder-passphrase').waitFor();await mark('holder-empty',4000);
 await page.locator('#holder-passphrase').fill(passphrase);
 await page.getByRole('button',{name:'Create holder wallet',exact:true}).click();await page.getByRole('heading',{name:'Your holder is unlocked'}).waitFor({timeout:45000});await mark('holder-created',4500);await frame('holder-created-ui');
 const identity=await page.locator('#holder-identity').inputValue();
 const offer=await operator({action:'approve',level:2,holder:JSON.parse(identity)});
 await page.locator('#holder-offer').fill(offer);await page.locator('#holder-offer').scrollIntoViewIfNeeded();await mark('issuer-offer',4000);
 await page.locator('#holder-passphrase').fill(passphrase);
 await page.getByRole('button',{name:'Receive signed credential'}).click();await page.getByRole('heading',{name:'1 signed credential',exact:true}).waitFor({timeout:65000});
 id=(await page.locator('.vp-holder-reference').first().innerText()).match(/[0-9a-f]{64}/)?.[0];if(!id)throw Error('Credential reference missing');
 await page.getByRole('heading',{name:'1 signed credential',exact:true}).scrollIntoViewIfNeeded();await mark('credential-issued',6000);await frame('credential-issued-ui');
 await page.getByRole('button',{name:'Check signatures and eligibility locally',exact:true}).click();await page.getByLabel('Verification result').waitFor({timeout:45000});await page.getByLabel('Verification result').scrollIntoViewIfNeeded();
 assertResult(await page.getByLabel('Verification result').innerText(),'approved-training');await mark('policy-one',6500);await frame('policy-one-ui');
 await page.locator('#holder-policy').selectOption('2');await page.getByRole('button',{name:'Check signatures and eligibility locally',exact:true}).click();await page.getByLabel('Verification result').waitFor({timeout:45000});await page.getByLabel('Verification result').scrollIntoViewIfNeeded();assertResult(await page.getByLabel('Verification result').innerText(),'professional-level');await mark('policy-two',6500);await frame('policy-two-ui');
 await page.getByRole('button',{name:'Save encrypted browser vault',exact:true}).click();await mark('vault-saved',3000);
 const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export encrypted backup',exact:true}).click();const download=await downloading;backupFile=path.join(dir,'disposable-filmed-holder.backup.json');await download.saveAs(backupFile);await mark('backup-exported',3000);
 await page.getByRole('button',{name:'Lock holder',exact:true}).click();await page.locator('#holder-passphrase').fill(passphrase);await page.getByRole('button',{name:'Unlock on this device',exact:true}).click();await page.getByRole('heading',{name:'Your holder is unlocked'}).waitFor({timeout:45000});await page.getByRole('heading',{name:'1 signed credential',exact:true}).scrollIntoViewIfNeeded();await mark('holder-restored',5000);
 await operator({action:'revoke',id});revoked=true;
 await page.getByRole('button',{name:'Check signatures and eligibility locally',exact:true}).click();await page.locator('.vp-alert-error').waitFor({timeout:45000});await page.locator('.vp-alert-error').scrollIntoViewIfNeeded();await expect(page.locator('.vp-alert-error')).toContainText(/not active|revoked/i);await mark('revoked-rejected',7500);await frame('revoked-ui');
 await page.goto(origin+'/api/readiness');await mark('readiness',4000);
 await page.goto(origin+'/issuer');await page.getByRole('heading',{name:'Approve an enrollment',exact:true}).scrollIntoViewIfNeeded();await mark('issuer-controls',6000);await frame('issuer-ui');
 await page.goto(origin);await mark('closing',4000);
 await writeFile(path.join(dir,'browser-evidence.json'),JSON.stringify({checkedAt:new Date().toISOString(),origin,actualHostedBrowser:true,disposableSyntheticHolder:true,holderOwnedKey:true,signedIssuance:true,localPolicies:[1,2],encryptedBackup:true,lockedAndUnlocked:true,revocationRejected:true,testCredentialLeftRevoked:true,networkProof:false,operatorApprovalViaAuthenticatedApi:true},null,2));
}finally{
 if(id&&!revoked)await operator({action:'revoke',id}).catch(()=>console.error('Cleanup revocation failed; inspect synthetic credential status'));
 const video=page.video();await context.close();await video.saveAs(path.join(dir,'hosted-browser-raw.webm'));
 await writeFile(path.join(dir,'browser-scenes.json'),JSON.stringify({scenes:marks,durationSeconds:(Date.now()-started)/1000},null,2));await browser.close();
}
function assertResult(text,policy){if(!text.includes(policy)||!text.includes('true'))throw Error('Expected local policy acceptance was not shown');}
console.log('Fresh deployed browser demonstration recorded. No Preprod proof claim.');
