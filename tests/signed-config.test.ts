import { expect, it } from 'vitest';
import path from 'node:path';
import { signedProjectRoot } from '../apps/web/lib/signed-network-config';
it('locates V3 artifacts from both repository and Next app working directories', () => {
  expect(signedProjectRoot(process.cwd())).toBe(process.cwd());
  expect(signedProjectRoot(path.resolve('apps/web'))).toBe(process.cwd());
  expect(() => signedProjectRoot('/private/tmp')).toThrow('workspace not found');
});
