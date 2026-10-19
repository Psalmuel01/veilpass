import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const origin = process.env.VEILPASS_UI_ORIGIN || 'http://127.0.0.1:3003';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && /hydration|hydrated|didn.t match/i.test(message.text())) errors.push(message.text()); });
await mkdir('docs/screenshots/theme', { recursive: true });
const theme = () => page.locator('html').getAttribute('data-theme');
async function capture(name) {
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Horizontal overflow: ${name}`);
  await page.screenshot({ path: `docs/screenshots/theme/${name}.png`, fullPage: true });
}
try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Dark mode', exact: true }).waitFor();
  assert.equal(await theme(), 'dark', 'Uses system appearance without saved preference');
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily), /spaceGrotesk/i);
  assert.equal(await page.evaluate(() => [...document.fonts].some(font => /spaceGrotesk/i.test(font.family) && font.status === 'loaded')), true, 'Bundled font loaded successfully');
  await capture('landing-dark');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  assert.equal(await theme(), 'light');
  await page.reload(); assert.equal(await theme(), 'light', 'Explicit choice survives reload and overrides system');
  await capture('landing-light');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  for (const route of ['/lifecycle', '/developers', '/hackathon', '/community', '/wallet']) {
    await page.goto(origin + route);
    assert.equal(await theme(), 'dark', `Appearance survives navigation to ${route}`);
    await page.getByRole('button', { name: 'Dark mode', exact: true }).waitFor();
    if (route === '/lifecycle') {
      await page.getByRole('button', { name: 'Initialize sample lifecycle' }).click();
      await page.locator('.vp-qualification-card').waitFor();
    }
    await capture(route.slice(1) + '-dark');
    await page.setViewportSize({ width: 360, height: 800 });
    await capture(route.slice(1) + '-dark-mobile');
    await page.setViewportSize({ width: 1440, height: 1100 });
  }
  await page.goto(origin);
  await page.setViewportSize({ width: 360, height: 800 }); await capture('landing-dark-mobile');
  await page.emulateMedia({ colorScheme: 'light' }); assert.equal(await theme(), 'dark', 'Explicit preference overrides system changes');
  const other = await context.newPage(); await other.goto(origin);
  await other.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await other.close();
  const restricted = await browser.newContext({ colorScheme: 'dark' });
  await restricted.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError'); } }); });
  const denied = await restricted.newPage(); denied.on('pageerror', e => errors.push(e.message));
  await denied.goto(origin); assert.equal(await denied.locator('html').getAttribute('data-theme'), 'dark');
  await denied.getByRole('button', { name: 'Dark mode', exact: true }).click();
  assert.equal(await denied.locator('html').getAttribute('data-theme'), 'light');
  await restricted.close();
  assert.deepEqual(errors, []);
  console.log('Theme acceptance passed: system default, local font, manual toggle, persistence, all routes, 360px layouts, cross-tab sync, denied storage, no browser errors.');
} finally { await browser.close(); }
