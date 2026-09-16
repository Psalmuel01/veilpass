import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { DAppConnectorWalletAdapter, type MidnightWalletProvider, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

export async function browserAuthorization(wallet: MidnightWalletProvider, config: EnvironmentConfiguration, contractAddress: string) {
  const interactive = process.env.VEILPASS_INTERACTIVE === '1';
  const adapter = new DAppConnectorWalletAdapter(wallet, config);
  const output = createWriteStream('/tmp/veilpass-browser-next.log');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', '3001'], { env: { ...process.env, NEXT_PUBLIC_NETWORK: 'undeployed', NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress, NEXT_PUBLIC_PROOF_SERVER: config.proofServer, VEILPASS_BUILD_DIR: '.next-e2e' }, stdio: ['ignore','pipe','pipe'] });
  server.stdout.pipe(output); server.stderr.pipe(output);
  const browser = await chromium.launch({ channel: 'chrome', headless: !interactive });
  try {
    for (let i = 0; i < 120; i++) {
      try { const r = await fetch('http://127.0.0.1:3001/api/config'); if (r.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // Real funded local wallet. This transports connector calls, not proof results.
    await page.exposeFunction('veilpassWalletCall', async (method: string, args: unknown[]) => {
      switch (method) {
        case 'getConfiguration': return adapter.getConfiguration();
        case 'getShieldedAddresses': return adapter.getShieldedAddresses();
        case 'balanceUnsealedTransaction': return adapter.balanceUnsealedTransaction(String(args[0]));
        case 'submitTransaction': return adapter.submitTransaction(String(args[0]));
        default: throw new Error('Unsupported wallet bridge method');
      }
    });
    await page.addInitScript(`
      const connected = {};
      for (const method of ['getConfiguration','getShieldedAddresses','balanceUnsealedTransaction','submitTransaction']) {
        connected[method] = (...args) => window.veilpassWalletCall(method,args);
      }
      window.midnight = { local: { name: 'Funded local test wallet', apiVersion:'4.0.1', connect: async network => {
        if(network !== 'undeployed') throw new Error('Local test wallet only');
        return connected;
      } } };
    `);
    await page.goto('http://127.0.0.1:3001');
    if (interactive) {
      console.log('Interactive local demo ready in Chrome at http://127.0.0.1:3001.');
      console.log('Choose Funded local test wallet. Transactions use real local Midnight proofs; no mainnet funds are involved. Close this Chrome window to stop the demo.');
      await new Promise<void>(resolve => browser.once('disconnected', () => resolve()));
      return null;
    }
    await page.getByRole('button',{name:'Launch demo',exact:true}).click();
    await page.getByLabel('Vault passphrase').fill('local-test-vault-passphrase');
    await page.getByRole('button',{name:'Get Demo Credential',exact:true}).click();
    await page.getByRole('button',{name:'Prove my eligibility'}).click();
    await page.getByRole('button',{name:'Connect wallet to continue'}).click();
    if (errors.length) throw new Error('Browser initialization failed: ' + errors.join('; '));
    await page.getByRole('button',{name:'Funded local test wallet',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 120000 });
    console.log('Browser wallet connected. Generating a real private proof through the UI...');
    await page.getByRole('button',{name:'Generate Private Proof',exact:true}).click();
    await Promise.race([
      page.getByRole('heading',{name:'Eligibility Verified',exact:true}).waitFor({timeout:300000}),
      page.locator('.alert.error').waitFor({timeout:300000}).then(async()=>{ throw new Error(`Browser verification failed: ${await page.locator('.alert.error').innerText()}`); }),
    ]);
    const txId = await page.locator('.receipt dd.mono').innerText();
    await mkdir('docs/screenshots',{recursive:true});
    await page.screenshot({path:'docs/screenshots/verified-local.png',fullPage:true});
    await page.getByRole('button',{name:'My credential',exact:true}).click();
    await page.getByRole('button',{name:/Ineligible graduate/}).click();
    await page.getByLabel('Vault passphrase').fill('local-test-vault-passphrase');
    await page.getByRole('button',{name:'Replace with demo credential'}).click();
    await expect(page.getByRole('button',{name:'Replace with demo credential'})).toBeEnabled();
    await page.getByRole('button',{name:'Prove my eligibility'}).click();
    await page.getByRole('button',{name:'Generate Private Proof',exact:true}).click();
    await expect(page.locator('.alert.error')).toContainText('Eligibility Not Verified', {timeout:60000});
    await page.screenshot({path:'docs/screenshots/rejected-local.png',fullPage:true});
    if(errors.length) throw new Error(`Browser runtime errors: ${errors.join('; ')}`);
    console.log('Browser real-wallet E2E passed: confirmed authorization and ineligible rejection.');
    return txId;
  } finally { await browser.close(); server.kill('SIGTERM'); output.end(); }
}
