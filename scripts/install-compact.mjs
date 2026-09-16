import { arch, platform } from 'node:os';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const target = `${arch() === 'arm64' ? 'aarch64' : arch() === 'x64' ? 'x86_64' : arch()}-${platform() === 'darwin' ? 'darwin' : platform() === 'linux' ? 'unknown-linux-musl' : platform()}`;
const hashes = {
  'aarch64-darwin':'57af9b0449aa96b2905ea3d7a175b6b42ab38d725612a9cb2d73eb4ef253cce2',
  'aarch64-unknown-linux-musl':'7c7e38581808779d2671687c3378017bcf2fb3111a192fd1253f3472012df549',
  'x86_64-darwin':'eebae2d04b1ec05fe07d06398e36d78e60cf4927ddbc0dae7d5f5ebb9ac6721c',
  'x86_64-unknown-linux-musl':'e291b4bab4d4e857707008f8b1c25c2b8e0c843f6c737d0ee6c0d9ac69a6bbfb',
};
if (!hashes[target]) throw new Error('Use Linux/WSL or macOS on arm64/x64.');
console.log(`Downloading Compact 0.31.1 for ${target}...`);
const response = await fetch(`https://github.com/LFDT-Minokawa/compact/releases/download/compactc-v0.31.1/compactc_v0.31.1_${target}.zip`);
if (!response.ok) throw new Error(`Compiler download failed: ${response.status}`);
const archive = Buffer.from(await response.arrayBuffer());
if (createHash('sha256').update(archive).digest('hex') !== hashes[target]) throw new Error('Compiler checksum mismatch');
await mkdir('.toolchain', {recursive:true});
await writeFile('.toolchain/compiler.zip', archive);
const result = spawnSync('unzip', ['-oq','.toolchain/compiler.zip','-d','.toolchain'], {stdio:'inherit'});
if(result.status !== 0) throw new Error('unzip failed; install unzip and retry.');
console.log('Verified and installed Compact 0.31.1 locally.');
