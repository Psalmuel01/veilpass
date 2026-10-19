import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin=process.env.VEILPASS_PUBLIC_ORIGIN || 'https://veilpass-beryl.vercel.app';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'});const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
try{
 for(const route of ['/','/lifecycle','/developers','/hackathon','/community','/live','/wallet']){
  const response=await page.goto(origin+route,{waitUntil:'domcontentloaded'});expect(response.status()).toBe(200);await expect(page.getByRole('complementary',{name:'Public preview information'})).toBeVisible();
  results.push({route,status:response.status()});
 }
 await page.goto(origin);await page.getByRole('button',{name:'Dark mode',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await mkdir('docs/screenshots/vercel',{recursive:true});await page.screenshot({path:'docs/screenshots/vercel/home-mobile.png',fullPage:true});
 await page.goto(origin+'/lifecycle');await expect(page.getByRole('button',{name:'Run the local demo to initialize',exact:true})).toBeDisabled();
 const disabled=await page.request.post(origin+'/api/lifecycle',{headers:{Origin:origin},data:{action:'initialize'}});expect(disabled.status()).toBe(503);expect((await disabled.json()).code).toBe('DISABLED');
 const live=await page.request.get(origin+'/api/live');expect(live.status()).toBe(503);expect((await live.json()).error).toContain('not configured');
 const rejected=await page.request.post(origin+'/api/live',{headers:{Origin:origin},data:{action:'challenge',policy:'approved-training'}});expect(rejected.status()).toBe(403);
 if(errors.length)throw new Error(errors.join('; '));
 await writeFile('docs/evidence/vercel-preview.json',JSON.stringify({url:origin,checkedAt:new Date().toISOString(),routes:results,themePersistence:true,mobileOverflow:false,hostedWorkbenchDisabled:true,unconfiguredLiveApiStatus:503,publicLiveWritesRejected:true,browserRuntimeErrors:errors},null,2));console.log('Public Vercel smoke checks passed:',results.length,'routes, theme, mobile and disabled local-only API.');
}finally{await browser.close();}
