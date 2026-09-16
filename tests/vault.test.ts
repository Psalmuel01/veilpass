import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { saveVault, unlockVault, deleteVault, hasVault } from '../apps/web/lib/vault';
import { safeError } from '../apps/web/lib/safe-error';
import { memoryPrivateStateProvider } from '../packages/credential/memory-provider';
import type { CredentialEnvelope } from '../packages/credential/index';
const storage = new Map<string,string>();
Object.defineProperty(globalThis, 'localStorage', {value:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)}});
const credential: CredentialEnvelope = {version:1,credential:{schemaVersion:1,issuer:'Example University',subject:'PRIVATE_SUBJECT',degree:'Computer Science',graduationYear:2024,studentId:'PRIVATE_STUDENT_ID',issuedAt:1780000000,secret:'ab'.repeat(32)},root:'cd'.repeat(32),sibling:'ef'.repeat(32),applicationId:'01'.repeat(32),isRight:false};
beforeEach(()=>storage.clear());
describe('holder vault',()=>{
  it('stores ciphertext only and decrypts with the correct passphrase',async()=>{
    await saveVault(credential,'a strong test passphrase');
    expect(hasVault()).toBe(true);
    const saved=storage.get('veilpass.vault.v1')!;
    for(const text of ['PRIVATE_SUBJECT','PRIVATE_STUDENT_ID','graduationYear',credential.credential.secret]) expect(saved).not.toContain(text);
    expect(await unlockVault('a strong test passphrase')).toEqual(credential);
    deleteVault();expect(hasVault()).toBe(false);
  });
  it('rejects incorrect passphrases and modified ciphertext',async()=>{
    await saveVault(credential,'a strong test passphrase');
    await expect(unlockVault('incorrect passphrase')).rejects.toThrow('Could not unlock');
    const data=JSON.parse(storage.get('veilpass.vault.v1')!);data.cipher='AAAA'+data.cipher.slice(4);storage.set('veilpass.vault.v1',JSON.stringify(data));
    await expect(unlockVault('a strong test passphrase')).rejects.toThrow('Could not unlock');
  });
  it('rejects weak passphrases and uses fresh salts/nonces',async()=>{
    await expect(saveVault(credential,'short')).rejects.toThrow('at least 12');
    await saveVault(credential,'a strong test passphrase');const first=storage.get('veilpass.vault.v1');
    await saveVault(credential,'a strong test passphrase');expect(storage.get('veilpass.vault.v1')).not.toBe(first);
  });
});
describe('private state boundary',()=>{
  it('isolates witness state by contract address',async()=>{
    const provider=memoryPrivateStateProvider<{secret:string}>();
    await expect(provider.get('holder')).rejects.toThrow('scope');
    provider.setContractAddress('a'.repeat(64));await provider.set('holder',{secret:'private'});
    provider.setContractAddress('b'.repeat(64));expect(await provider.get('holder')).toBe(null);
    provider.setContractAddress('a'.repeat(64));expect(await provider.get('holder')).toEqual({secret:'private'});
    await expect(provider.exportPrivateStates()).rejects.toThrow('disabled');
  });
  it('does not echo raw SDK error payloads to the holder/verifier UI',()=>{
    expect(safeError(new Error('PRIVATE_STUDENT_ID: unexpected witness data'))).not.toContain('PRIVATE_STUDENT_ID');
    expect(safeError(new Error('Credential does not satisfy policy: PRIVATE_STUDENT_ID'))).toContain('Eligibility Not Verified');
    expect(safeError(new Error('wallet user rejected'))).toContain('declined');
    expect(safeError(new Error('Failed to fetch'))).toContain('Connection interrupted');
  });
  it('discloses no individual credential fields in the authorize circuit',()=>{
    const source=readFileSync('contracts/veilpass/veilpass.compact','utf8').split('export circuit authorize')[1];
    expect(source.match(/disclose\(/g)?.length).toBe(1);
    expect(source).toContain('disclose(authorizationNullifier');
  });
});
