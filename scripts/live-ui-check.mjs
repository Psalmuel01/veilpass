import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.VEILPASS_UI_ORIGIN || 'http://127.0.0.1:3003';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:360,height:800},colorScheme:'dark'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/live');
 await page.getByRole('heading',{name:/Confirmed on Midnight/}).waitFor();
 await page.getByRole('alert').filter({hasText:'Live V2 deployment is not configured'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Generate and submit proof',exact:true}).count(),0);
 for(const width of [360,390,480,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overflow at '+width);}
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 const denied=await fetch(origin+'/api/live',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
 const foreign=await fetch(origin+'/api/live',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'});assert.equal(foreign.status,403);
 const oversized=await fetch(origin+'/api/live',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:'x'.repeat(2049)});assert.equal(oversized.status,413);
 assert.deepEqual(errors,[]);
 console.log('Live UI passed: explicit unconfigured state, no fake proof action, mobile layout, theme switching, origin restrictions and body bound.');
} finally {await browser.close();}
