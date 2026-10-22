import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// Git checkouts omit generated Compact code. Generate JavaScript only for the
// public preview; proof-key generation remains part of the local proof setup.
const missing = ['veilpass', 'lifecycle'].filter(name => !existsSync(`contracts/${name}/managed/contract/index.js`));
if (missing.length) {
  execFileSync(process.execPath, ['scripts/install-compact.mjs'], { stdio: 'inherit' });
  for (const name of missing) execFileSync(process.execPath, ['scripts/compile.mjs', ...(name === 'lifecycle' ? ['--lifecycle'] : []), '--skip-zk'], { stdio: 'inherit' });
}
execFileSync(process.execPath, ['integrations/issuance/compile.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['integrations/issuance/compile.mjs', '--authorization'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/preprod-assets.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', 'apps/web'], { stdio: 'inherit' });
