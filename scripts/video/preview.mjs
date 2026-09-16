// Renders a handful of still frames from the composition so the layout can be
// checked before doing a full render.
//
//   node scripts/video/preview.mjs [seconds...]

import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { BRAND, SCENES } from './script.mjs';

const manifest = JSON.parse(await readFile('.cache/narration/manifest.json', 'utf8'));
const byId = Object.fromEntries(manifest.scenes.map(s => [s.id, s]));

const scenes = SCENES.map(s => ({
  id: s.id, kind: s.kind,
  title: s.title ?? '', subtitle: s.subtitle ?? '',
  caption: s.caption ?? '', callout: s.callout ?? '',
  clip: s.clip ?? null,
  still: s.still ? `file://${path.resolve(s.still)}` : null,
  duration: byId[s.id].duration,
}));

// Default: the midpoint of every scene.
let marks = process.argv.slice(2).map(Number);
if (!marks.length) {
  let acc = 0;
  marks = scenes.map(s => { const m = acc + s.duration / 2; acc += s.duration; return Number(m.toFixed(1)); });
}

const out = '.cache/preview';
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--autoplay-policy=no-user-gesture-required', '--window-position=-3000,-3000', '--force-device-scale-factor=1'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`file://${path.resolve('scripts/video/composition.html')}`);
  await page.evaluate(({ brand, scenes }) => window.__setup({ brand, scenes, videoSize: { w: 1440, h: 1050 } }), { brand: BRAND, scenes });

  await page.evaluate(async (src) => {
    const v = document.createElement('video');
    v.src = src;
    v.muted = true; v.preload = 'auto'; v.style.display = 'none';
    document.body.appendChild(v);
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('load failed')); });
    window.__attachVideo(v);
  }, `file://${path.resolve('docs/video/veilpass-demo-raw.webm')}`);

  // Screen scenes draw from pre-extracted clip frames, same as the renderer.
  await page.evaluate(() => window.__preload(12));

  for (const t of marks) {
    await page.evaluate(async (time) => { await window.__seek(time); }, t);
    const file = path.join(out, `t${String(t).replace('.', '_')}.png`);
    await page.screenshot({ path: file, animations: 'disabled' });
    console.log(`  ${file}`);
  }
} finally {
  await browser.close();
}
