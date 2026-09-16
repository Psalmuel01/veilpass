import type { CredentialEnvelope } from '../../../packages/credential/index';
const KEY = 'veilpass.vault.v1';
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const bytes = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function key(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 310000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export function hasVault() { return localStorage.getItem(KEY) !== null; }
export function deleteVault() { localStorage.removeItem(KEY); }
export async function saveVault(envelope: CredentialEnvelope, passphrase: string) {
  if (passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(passphrase, salt), new TextEncoder().encode(JSON.stringify(envelope)));
  localStorage.setItem(KEY, JSON.stringify({ version: 1, salt: b64(salt), iv: b64(iv), cipher: b64(new Uint8Array(cipher)) }));
}
export async function unlockVault(passphrase: string): Promise<CredentialEnvelope> {
  const raw = localStorage.getItem(KEY);
  if (!raw) throw new Error('No saved credential on this browser.');
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1) throw new Error();
    const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(data.iv) }, await key(passphrase, bytes(data.salt)), bytes(data.cipher));
    return JSON.parse(new TextDecoder().decode(decoded));
  } catch { throw new Error('Could not unlock the vault. Check your passphrase.'); }
}
