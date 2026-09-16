import { existsSync } from 'node:fs';
import path from 'node:path';
export function issuerFile(name: 'issuer-batch.json' | 'deployment-inputs.json') {
  const roots = [process.cwd(), path.resolve(process.cwd(), '../..')];
  const root = roots.find(root => existsSync(path.join(root, '.private', name)));
  if (!root) throw new Error('Issuer setup required');
  return path.join(root, '.private', name);
}
