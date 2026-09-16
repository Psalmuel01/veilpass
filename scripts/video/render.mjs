// Renders the promo video in two passes:
//
//   1. Step the composition frame by frame and capture each frame as a JPEG.
//      This is slower than realtime but every frame is exact, and seeking the
//      embedded screen recording is reliable.
//   2. Play those frames back at realtime into a MediaRecorder with the
//      narration mixed in, producing one MP4 with audio.
//
// The two passes exist because MediaRecorder runs on a wall clock: recording
// during pass 1 would drift as soon as a frame takes longer than 1/fps.
//
//   node scripts/video/render.mjs
//
// Inputs:  docs/video/veilpass-demo-raw.webm  (the real UI recording)
//          .cache/narration/*.m4a             (from narrate.mjs)
// Output:  docs/video/veilpass-promo.mp4

import { chromium } from '@playwright/test';
import { readFile, writeFile, stat, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { BRAND, SCENES } from './script.mjs';

const FPS = 30;
const SOURCE = 'docs/video/veilpass-demo-raw.webm';
const OUTPUT = 'docs/video/veilpass-promo.mp4';
const FRAME_DIR = '.cache/frames';

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

const total = scenes.reduce((sum, s) => sum + s.duration, 0);
const frameCount = Math.round(total * FPS);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--window-position=-3000,-3000',
    '--force-device-scale-factor=1',
    // Pass 2 loads frame images from disk into a file:// page.
    '--allow-file-access-from-files',
  ],
});

try {
  // ---------- pass 1: capture frames ----------
  console.log(`Pass 1 — capturing ${frameCount} frames (${total.toFixed(1)}s)...`);
  await rm(FRAME_DIR, { recursive: true, force: true });
  await mkdir(FRAME_DIR, { recursive: true });

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`file://${path.resolve('scripts/video/composition.html')}`);
  await page.evaluate(
    ({ brand, scenes }) => window.__setup({ brand, scenes, videoSize: { w: 1440, h: 1050 } }),
    { brand: BRAND, scenes },
  );

  // Load the recording from disk rather than a base64 blob: the composition
  // page is itself a file:// URL, and keeping an 11MB blob in memory while
  // seeking it thousands of times crashes the renderer.
  await page.evaluate(async (src) => {
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.preload = 'auto';
    v.style.display = 'none';
    document.body.appendChild(v);
    await new Promise((res, rej) => {
      v.onloadedmetadata = res;
      v.onerror = () => rej(new Error('Could not load the screen recording'));
    });
    window.__attachVideo(v);
  }, `file://${path.resolve(SOURCE)}`);

  // Do all the video seeking once, before capture starts.
  const strips = await page.evaluate(() => window.__preload(12));
  console.log('  clip frames extracted:', Object.entries(strips).map(([k, v]) => `${k}=${v}`).join(' '));

  for (let i = 0; i < frameCount; i++) {
    const file = path.join(FRAME_DIR, `${String(i).padStart(5, '0')}.jpg`);
    try {
      await page.evaluate(async (t) => { await window.__seek(t); }, i / FPS);
      await page.screenshot({ path: file, type: 'jpeg', quality: 90, animations: 'disabled' });
    } catch (err) {
      // A renderer crash loses the page but not the frames already written.
      // Reuse the previous frame so one bad seek doesn't abort a long render.
      console.log(`  frame ${i}: ${err.message.split('\n')[0]} — reusing previous frame`);
      const prev = path.join(FRAME_DIR, `${String(Math.max(0, i - 1)).padStart(5, '0')}.jpg`);
      await writeFile(file, await readFile(prev));
    }
    if (i % (FPS * 10) === 0) console.log(`  ${(i / FPS).toFixed(0)}s / ${total.toFixed(0)}s`);
  }
  await page.close();

  // ---------- pass 2: play back at realtime with audio ----------
  console.log('Pass 2 — encoding with narration...');
  const player = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  // A file:// origin, so the frame images on disk are same-origin.
  await player.goto(`file://${path.resolve('scripts/video/composition.html')}`);

  const audio = await Promise.all(
    manifest.scenes.map(async s => ({ id: s.id, data: (await readFile(s.file)).toString('base64') })),
  );

  // Reference frames by file URL. Passing ~300MB of base64 through evaluate
  // would exhaust memory before playback even starts.
  const frameUrls = [];
  for (let i = 0; i < frameCount; i++) {
    frameUrls.push(`file://${path.resolve(FRAME_DIR, `${String(i).padStart(5, '0')}.jpg`)}`);
  }

  const data = await player.evaluate(async ({ frameUrls, audio, scenes, fps }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920; canvas.height = 1080;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });

    // Decoding all frames up front exhausts memory, so keep a small rolling
    // window: decode ahead of playback and release frames once drawn.
    const AHEAD = 90;
    const cache = new Map();
    const load = async (i) => {
      if (i >= frameUrls.length || cache.has(i)) return;
      const img = new Image();
      img.src = frameUrls[i];
      cache.set(i, img.decode().then(() => img));
    };
    for (let i = 0; i < Math.min(AHEAD, frameUrls.length); i++) load(i);

    const actx = new AudioContext({ sampleRate: 48000 });
    const dest = actx.createMediaStreamDestination();
    const buffers = {};
    for (const a of audio) {
      const bytes = Uint8Array.from(atob(a.data), c => c.charCodeAt(0));
      buffers[a.id] = await actx.decodeAudioData(bytes.buffer);
    }

    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);

    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')
      ? 'video/mp4;codecs=avc1,mp4a.40.2'
      : 'video/mp4';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    // Schedule the narration against the audio clock, then run the frames on
    // the same timeline so picture and voice stay locked together.
    const start = actx.currentTime + 0.3;
    let acc = 0;
    for (const s of scenes) {
      const buf = buffers[s.id];
      if (buf) {
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(start + acc + 0.25);
      }
      acc += s.duration;
    }

    rec.start();
    const t0 = performance.now();
    for (let i = 0; i < frameUrls.length; i++) {
      const due = t0 + (i * 1000) / fps;
      const wait = due - performance.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      const img = await cache.get(i);
      ctx.drawImage(img, 0, 0, 1920, 1080);
      track.requestFrame();
      cache.delete(i);
      load(i + AHEAD);
    }
    // Let the tail of the last line finish before cutting.
    await new Promise(r => setTimeout(r, 600));

    await new Promise(res => { rec.onstop = res; rec.stop(); });
    const blob = new Blob(chunks, { type: 'video/mp4' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }, { frameUrls, audio, scenes, fps: FPS });

  await writeFile(OUTPUT, Buffer.from(data, 'base64'));
  const { size } = await stat(OUTPUT);
  console.log(`\nWrote ${OUTPUT} — ${total.toFixed(1)}s, ${(size / 1_048_576).toFixed(1)} MB`);
} finally {
  await browser.close();
}
