import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import path from 'node:path';
function locate(dir) {
  if (!existsSync(dir)) return undefined;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === 'compactc' && e.isFile()) return path.resolve(p);
    if (e.isDirectory()) { const found = locate(p); if (found) return found; }
  }
}
const compiler = process.env.COMPACTC ?? locate('.toolchain');
if (!compiler) throw new Error('Install Compact 0.31.1 under .toolchain or set COMPACTC. See README.');
const version = spawnSync(compiler, ['--version'], { encoding: 'utf8' });
if (version.status !== 0 || version.stdout.trim() !== '0.31.1') throw new Error('VeilPass requires Compact 0.31.1. Run npm run toolchain:install.');
const skip = process.argv.includes('--skip-zk');
const result = spawnSync(compiler, [...(skip ? ['--skip-zk'] : []), 'contracts/veilpass/veilpass.compact', 'contracts/veilpass/managed'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
if (!skip) {
  mkdirSync('apps/web/public/zk', { recursive: true });
  for (const sub of ['keys', 'zkir']) cpSync(`contracts/veilpass/managed/${sub}`, `apps/web/public/zk/${sub}`, { recursive: true });
}
