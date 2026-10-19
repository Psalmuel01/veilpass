import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory=path.resolve('.cache/video-v2');await mkdir(directory,{recursive:true});
const origin=process.env.VEILPASS_VIDEO_ORIGIN || 'http://127.0.0.1:3003';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},colorScheme:'dark',reducedMotion:'reduce',recordVideo:{dir:directory,size:{width:1600,height:900}}});
const page=await context.newPage();const started=Date.now();const scenes=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
const mark=async(name,hold=0)=>{scenes.push({name,seconds:(Date.now()-started)/1000});if(hold)await page.waitForTimeout(hold);};
try {
 await mark('video-origin');await page.goto(origin+'/');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
 await mark('hero',14000);await mark('hero-end');
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();await mark('light-mode',5000);await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 await page.goto(origin+'/lifecycle');await page.getByRole('button',{name:'Initialize sample lifecycle'}).click();await page.locator('.vp-qualification-card').waitFor();await page.evaluate(()=>{document.documentElement.style.scrollBehavior='auto';scrollTo({top:140,left:0,behavior:'instant'});});
 await mark('qualification',16000);await mark('qualification-end');
 await page.getByRole('button',{name:/1. Request a fresh challenge/}).click();await page.getByRole('button',{name:/2. Evaluate Compact constraints/}).click();await page.getByText(/Constraints accepted in/).waitFor();await page.getByRole('button',{name:/3. Verify with SDK/}).click();await page.getByRole('heading',{name:'Eligible',exact:true}).waitFor();await mark('sandbox-result',6000);
 await page.getByRole('button',{name:/Community access/}).click();await page.getByText('Try a different qualification',{exact:true}).click();await page.getByLabel('Test level 1 credential').check();await page.getByRole('button',{name:/1. Request a fresh challenge/}).click();await page.getByRole('button',{name:/2. Evaluate Compact constraints/}).click();await expect(page.getByRole('alert').filter({hasText:'Qualification level too low'})).toBeVisible();await mark('level-rejected',6000);
 await page.goto(origin+'/developers');await page.getByRole('heading',{name:'Integrate a verifier',exact:true}).scrollIntoViewIfNeeded();await mark('developers',15000);await mark('developers-end');
 if(errors.length)throw new Error(errors.join('; '));
}finally{const video=page.video();await context.close();await video.saveAs(path.join(directory,'product-raw.webm'));await writeFile(path.join(directory,'product-scenes.json'),JSON.stringify({scenes,durationSeconds:(Date.now()-started)/1000},null,2));await browser.close();}
console.log('Product footage captured.');
