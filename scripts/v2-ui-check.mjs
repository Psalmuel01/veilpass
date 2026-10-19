import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.VEILPASS_UI_ORIGIN || 'http://127.0.0.1:3000';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${origin}/lifecycle`);
 await page.getByRole('button',{name:'Initialize sample lifecycle'}).click();
 await page.locator('.vp-qualification-card').waitFor();
 await page.getByRole('button',{name:/1. Request a fresh challenge/}).click();
 await page.getByRole('button',{name:/2. Evaluate Compact constraints/}).click();
 await page.getByText(/Constraints accepted in/).waitFor();
 await page.getByRole('button',{name:/3. Verify with SDK/}).click();
 await page.getByRole('heading',{name:'Eligible',exact:true}).waitFor();
 await mkdir('docs/screenshots/v2',{recursive:true});
 await page.screenshot({path:'docs/screenshots/v2/lifecycle-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/3. Verify with SDK/}).click();
 await page.getByRole('alert').filter({hasText:'Challenge already consumed'}).waitFor();
 await page.getByRole('button',{name:/Community access/}).click();
 await page.getByText('Try a different qualification', {exact:true}).click();
 await page.getByLabel('Test level 1 credential').check();
 await page.getByRole('button',{name:/1. Request a fresh challenge/}).click();
 await page.getByRole('button',{name:/2. Evaluate Compact constraints/}).click();
 await page.getByRole('alert').filter({hasText:'Qualification level too low'}).waitFor();
 await page.getByLabel('Test level 1 credential').uncheck();
 await page.getByRole('button',{name:/2. Evaluate Compact constraints/}).click();
 await page.getByText(/Constraints accepted in/).waitFor();
 await page.getByRole('button',{name:/3. Verify with SDK/}).click();
 await page.getByRole('heading',{name:'Eligible',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile horizontal overflow');
 await page.screenshot({path:'docs/screenshots/v2/lifecycle-mobile.png',fullPage:true});
 await page.getByText('Manage sample qualification', {exact:true}).click();
 await page.getByRole('button',{name:'Revoke qualification',exact:true}).click();
 await page.getByText('Revoked',{exact:true}).waitFor();
 for(const route of ['hackathon','community']){
  await page.goto(`${origin}/${route}`);
  await page.getByRole('button',{name:'Check sample qualification'}).click();
  await page.getByRole('alert').filter({hasText:'Credential is revoked'}).waitFor();
 }
 await page.goto(`${origin}/developers`);
 await page.getByRole('heading',{name:'Integrate a verifier'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('V2 browser acceptance passed: two policies, level rejection, replay, revocation in both apps, SDK portal and mobile layout. Generated execution only.');
}finally{await browser.close();}
