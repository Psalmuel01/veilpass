import { pureCircuits } from '../contracts/veilpass/managed/contract/index.js';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { bytes32, commitment, contract, toHex, ISSUER, type CredentialEnvelope } from '../packages/credential/index.js';

// The demo issuer, not the holder, chooses this immutable two-credential batch.
// Never overwrite a batch after deploying its root.
try { await access('.private/issuer-batch.json'); throw new Error('Issuer batch exists. Use its existing deployment or explicitly move it aside for a NEW contract.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
const app = randomBytes(32).toString('hex');
const make = (year: number): CredentialEnvelope => ({ version: 1, credential: { schemaVersion: 1, issuer: ISSUER, subject: `holder-${randomBytes(8).toString('hex')}`, degree: 'Computer Science', graduationYear: year, studentId: `STUDENT-${randomBytes(5).toString('hex')}`, issuedAt: Math.floor(Date.now()/1000), secret: randomBytes(32).toString('hex') }, sibling: '00'.repeat(32), isRight: year === 2018, root: '00'.repeat(32), applicationId: app });
const valid = make(2024), invalid = make(2018);
const left = commitment(valid), right = commitment(invalid);
const root = toHex(pureCircuits.batchRoot(left, right));
valid.root = invalid.root = root; valid.sibling = toHex(right); invalid.sibling = toHex(left);
await mkdir('.private', { recursive: true, mode: 0o700 });
await writeFile('.private/issuer-batch.json', JSON.stringify({ valid, invalid }), { mode: 0o600 });
await writeFile('.private/deployment-inputs.json', JSON.stringify({ root, issuer: toHex(bytes32(ISSUER)), applicationId: app }, null, 2), { mode: 0o600 });
console.log('Created private demo issuer batch. No credential attributes logged. Deployment inputs: .private/deployment-inputs.json');
