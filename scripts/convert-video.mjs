// Converts the recorded .webm demo to .mp4, which is what submission forms
// usually accept. Uses Chrome's own H.264 encoder through MediaRecorder so the
// repo doesn't need ffmpeg installed.
//
//   node scripts/convert-video.mjs [input.webm] [output.mp4]

import { chromium } from '@playwright/test';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const input = process.argv[2] ?? 'docs/video/veilpass-demo-raw.webm';
const output = process.argv[3] ?? 'docs/video/veilpass-demo.mp4';

const source = await readFile(input);
// Headless Chrome throttles rendering and never fires requestVideoFrameCallback
// reliably, so the draw loop below would stall. Headed with muted autoplay works.
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--autoplay-policy=no-user-gesture-required', '--window-position=-2400,-2400'],
});

try {
  const page = await browser.newPage();
  // A file:// page would need the video on disk next to it; passing the bytes
  // in as base64 keeps the source wherever the caller put it.
  await page.goto('about:blank');
  const encoded = source.toString('base64');

  const result = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'video/webm' }));

    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Could not decode the source video'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
      ? 'video/mp4;codecs=avc1'
      : 'video/mp4';
    const recorder = new MediaRecorder(canvas.captureStream(30), {
      mimeType: mime,
      videoBitsPerSecond: 4_000_000,
    });

    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(resolve => { recorder.onstop = resolve; });

    recorder.start();
    await video.play();

    // A fixed-interval draw keeps working even when the tab is throttled;
    // requestVideoFrameCallback stalls indefinitely in some headless setups.
    await new Promise(resolve => {
      const timer = setInterval(() => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (video.ended) { clearInterval(timer); resolve(); }
      }, 1000 / 30);
      video.onended = () => { clearInterval(timer); resolve(); };
    });

    recorder.stop();
    await done;
    URL.revokeObjectURL(url);

    const blob = new Blob(chunks, { type: 'video/mp4' });
    const buffer = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of buffer) binary += String.fromCharCode(byte);
    return { data: btoa(binary), width: canvas.width, height: canvas.height, duration: video.duration };
  }, encoded);

  await writeFile(output, Buffer.from(result.data, 'base64'));
  const { size } = await stat(output);
  console.log(
    `Wrote ${path.relative(process.cwd(), output)} — ` +
      `${result.width}x${result.height}, ${result.duration.toFixed(1)}s, ` +
      `${(size / 1_048_576).toFixed(1)} MB`,
  );
} finally {
  await browser.close();
}
