// Renders each scene's narration with macOS `say`, converts it to AAC, and
// records the real duration so the visual timeline can be fitted to the audio
// rather than guessed.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { SCENES } from './script.mjs';

const run = promisify(execFile);
const OUT = '.cache/narration';
const VOICE = process.env.VEILPASS_VOICE ?? 'Samantha';
const RATE = process.env.VEILPASS_RATE ?? '172';

// afinfo reports the exact duration of the encoded file.
async function durationOf(file) {
  const { stdout } = await run('afinfo', [file]);
  const match = stdout.match(/estimated duration:\s*([\d.]+)\s*sec/i);
  if (!match) throw new Error(`Could not read duration from afinfo for ${file}`);
  return Number(match[1]);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const manifest = [];

for (const scene of SCENES) {
  const aiff = path.join(OUT, `${scene.id}.aiff`);
  const m4a = path.join(OUT, `${scene.id}.m4a`);

  await run('say', ['-v', VOICE, '-r', RATE, '-o', aiff, scene.narration]);
  await run('afconvert', ['-f', 'mp4f', '-d', 'aac', aiff, m4a]);
  await rm(aiff, { force: true });

  const spoken = await durationOf(m4a);
  // Leave a beat after each line so scenes don't cut on the final syllable.
  const duration = Math.max(scene.min, spoken + 1.1);
  manifest.push({ id: scene.id, file: m4a, spoken, duration });
  console.log(`${scene.id.padEnd(11)} spoken ${spoken.toFixed(1)}s  scene ${duration.toFixed(1)}s`);
}

const total = manifest.reduce((sum, s) => sum + s.duration, 0);
await writeFile(path.join(OUT, 'manifest.json'), JSON.stringify({ scenes: manifest, total }, null, 2));
console.log(`\nTotal ${total.toFixed(1)}s (${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')})`);
