// SPDX-License-Identifier: Apache-2.0
import { mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Challenge, ChallengeStore } from './index';
/** Local single-filesystem durable state. Use a transactional shared DB for multi-host deployments. */
export class FileChallengeStore implements ChallengeStore {
  constructor(private directory: string) {}
  private file(id: string, suffix: string) {
    if (!/^[0-9a-f]{64}$/.test(id)) throw new Error('Invalid challenge ID');
    return path.join(this.directory, `${id}.${suffix}`);
  }
  private async exclusive(file: string, data: string) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const handle = await open(file, 'wx', 0o600);
    try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
    const directory = await open(this.directory, "r");
    try { await directory.sync(); } finally { await directory.close(); }
  }
  async put(c: Challenge) { await this.exclusive(this.file(c.id, 'json'), JSON.stringify(c)); }
  async get(id: string): Promise<Challenge | null> {
    try { return JSON.parse(await readFile(this.file(id, 'json'), 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  async consume(id: string) {
    if (!await this.get(id)) return false;
    try { await this.exclusive(this.file(id, 'used'), 'consumed'); return true; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false; throw e; }
  }
}
