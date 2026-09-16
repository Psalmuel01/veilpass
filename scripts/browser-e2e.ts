import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { DAppConnectorWalletAdapter, type MidnightWalletProvider, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';

export async function browserAuthorization(wallet: MidnightWalletProvider, config: EnvironmentConfiguration, contractAddress: string) {
  const recording = process.env.VEILPASS_RECORD === '1';
  const chapters: { seconds: number; text: string }[] = [];
  const interactive = process.env.VEILPASS_INTERACTIVE === '1';
  const port = recording ? '3002' : '3001';
  const origin = `http://127.0.0.1:${port}`;
  const adapter = new DAppConnectorWalletAdapter(wallet, config);
  const output = createWriteStream('/tmp/veilpass-browser-next.log');
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', 'apps/web', '--hostname', '127.0.0.1', '--port', port], { env: { ...process.env, NEXT_PUBLIC_NETWORK: 'undeployed', NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress, NEXT_PUBLIC_PROOF_SERVER: config.proofServer, VEILPASS_BUILD_DIR: recording ? '.next-recording' : '.next-e2e' }, stdio: ['ignore','pipe','pipe'] });
  server.stdout.pipe(output); server.stderr.pipe(output);
  const browser = await chromium.launch({ channel: 'chrome', headless: !interactive });
  try {
    for (let i = 0; i < 120; i++) {
      try { const r = await fetch(`${origin}/api/config`); if (r.ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    await mkdir('docs/video', { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, ...(recording ? {recordVideo:{dir:'.cache/recordings',size:{width:1440,height:1050}}} : {}) });
    const started = Date.now();
    const scene = async (text: string, seconds = 12) => {
      if (!recording) return;
      chapters.push({seconds:(Date.now()-started)/1000,text});
      await new Promise(resolve => setTimeout(resolve, seconds*1000));
    };
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
    await page.goto(origin);
    if (interactive) {
      console.log('Interactive local demo ready in Chrome at http://127.0.0.1:3001.');
      console.log('Choose Funded local test wallet. Transactions use real local Midnight proofs; no mainnet funds are involved. Close this Chrome window to stop the demo.');
      await new Promise<void>(resolve => browser.once('disconnected', () => resolve()));
      return null;
    }
    await scene('VeilPass • Phase 1 demo\nProve eligibility without disclosing the underlying academic record.',16);
    await page.getByRole('button',{name:'Launch demo',exact:true}).click();
    await scene('Two shared demo credentials. One fixed policy.\nThis walkthrough uses a real, disposable local Midnight network.',14);
    await page.getByLabel('Vault passphrase').fill('local-test-vault-passphrase');
    await page.getByRole('button',{name:'Get Demo Credential',exact:true}).click();
    await expect(page.getByRole('button',{name:'Prove my eligibility'})).toBeVisible();
    await scene('The credential is encrypted in this browser with a passphrase.\nStudent ID, subject, degree, and exact year remain private inputs.',15);
    await page.getByRole('button',{name:'Prove my eligibility'}).click();
    await scene('Policy: approved university and graduation year ≥ 2020.\nThe public authorization contains a scoped nullifier, not the credential.',15);
    await page.getByRole('button',{name:'Connect wallet to continue'}).click();
    if (errors.length) throw new Error('Browser initialization failed: ' + errors.join('; '));
    await page.getByRole('button',{name:'Funded local test wallet',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 120000 });
    await scene('A funded development wallet connects through the Midnight connector adapter.\nIt auto-approves local transactions; this is not an installed wallet extension.',14);
    console.log('Browser wallet connected. Generating a real private proof through the UI...');
    await page.getByRole('button',{name:'Generate Private Proof',exact:true}).click();
    await scene('Real proof generation, wallet balancing, submission, and confirmation.\nNo simulated proof result. The local prover receives private witness data.',1);
    await Promise.race([
      page.getByRole('heading',{name:'Eligibility Verified',exact:true}).waitFor({timeout:300000}),
      page.locator('.alert.error').waitFor({timeout:300000}).then(async()=>{ throw new Error(`Browser verification failed: ${await page.locator('.alert.error').innerText()}`); }),
    ]);
    await scene('Authorization confirmed on the local Midnight chain.\nThe receipt shows the actual transaction and block, not a public Preprod deployment.',18);
    const txId = await page.locator('.receipt dd.mono').innerText();
    await mkdir('docs/screenshots',{recursive:true});
    await page.screenshot({path:'docs/screenshots/verified-local.png',fullPage:true});
    await page.getByRole('button',{name:/My credential/}).click();
    await page.getByRole('button',{name:/Ineligible graduate/}).click();
    await scene('Now select the ineligible graduate sample.\nAuthenticity alone is insufficient: the private year must satisfy the policy.',14);
    await page.getByLabel('Vault passphrase').fill('local-test-vault-passphrase');
    await page.getByRole('button',{name:'Replace with demo credential'}).click();
    await expect(page.getByRole('button',{name:'Replace with demo credential'})).toBeEnabled();
    await page.getByRole('button',{name:'Prove my eligibility'}).click();
    await page.getByRole('button',{name:'Generate Private Proof',exact:true}).click();
    await expect(page.locator('.alert.error')).toContainText('Eligibility Not Verified', {timeout:60000});
    await page.screenshot({path:'docs/screenshots/rejected-local.png',fullPage:true});
    await scene('The circuit rejects the ineligible credential. No success receipt is issued.\nReplay protection is also checked in the integration test.',16);
    await page.getByRole('button',{name:'Privacy model',exact:true}).click();
    await scene('Demo limits: shared bearer credentials, small anonymity set, and a trusted local prover.\nProduction identity, revocation, recovery, and independent audit are future work.',18);
    if(recording) {
      const video = page.video()!;
      await writeFile('docs/video/chapters.json',JSON.stringify({chapters,duration:(Date.now()-started)/1000},null,2));
      await page.close();
      await video.saveAs('docs/video/veilpass-demo-raw.webm');
    }
    if(errors.length) throw new Error(`Browser runtime errors: ${errors.join('; ')}`);
    console.log('Browser real-wallet E2E passed: confirmed authorization and ineligible rejection.');
    return txId;
  } finally { await browser.close(); server.kill('SIGTERM'); output.end(); }
}
