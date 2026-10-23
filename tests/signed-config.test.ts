import { afterEach, expect, it, vi } from 'vitest';
import path from 'node:path';
import { signedProjectRoot, signedNetworkConfig } from '../apps/web/lib/signed-network-config';
it('locates V3 artifacts from both repository and Next app working directories', () => {
  expect(signedProjectRoot(process.cwd())).toBe(process.cwd());
  expect(signedProjectRoot(path.resolve('apps/web'))).toBe(process.cwd());
  expect(() => signedProjectRoot('/private/tmp')).toThrow('workspace not found');
});

afterEach(() => vi.unstubAllEnvs());
function hostedConfig() {
 vi.stubEnv('VERCEL', undefined);
 vi.stubEnv('VEILPASS_SIGNED_NETWORK', '1');
 vi.stubEnv('VEILPASS_HOSTED_BACKEND', '1');
 vi.stubEnv('VEILPASS_SIGNED_NETWORK_CONFIG', 'deploy/preprod/network.json');
}
it('publishes only an explicitly pinned HTTPS prover from operator configuration', async () => {
 hostedConfig();
 vi.stubEnv('VEILPASS_TRUSTED_PROVER_ORIGIN', 'https://prover.example.test');
 const c=await signedNetworkConfig();
 expect(c.proofServer).toBe('https://prover.example.test');
 expect(c.trustedProverOrigin).toBe(c.proofServer);
});
it('refuses an unsafe operator prover and keeps the public release gate', async () => {
 hostedConfig();
 vi.stubEnv('VEILPASS_TRUSTED_PROVER_ORIGIN', 'http://prover.example.test');
 await expect(signedNetworkConfig()).rejects.toThrow('HTTPS');
 vi.stubEnv('VEILPASS_SIGNED_NETWORK', '0');
 await expect(signedNetworkConfig()).rejects.toThrow('not configured');
});
