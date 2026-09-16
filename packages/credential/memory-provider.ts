import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';
// Active witness state exists only for the current session. Persistent storage
// belongs to the separately encrypted holder vault, never the verifier backend.
export function memoryPrivateStateProvider<T>(): PrivateStateProvider<string, T> {
  let address: string | undefined;
  const states = new Map<string, T>(), keys = new Map<string, string>();
  const id = (name: string) => { if (!address) throw new Error('Contract scope is required'); return `${address}:${name}`; };
  const unsupported = async (): Promise<never> => { throw new Error('Use the encrypted holder vault; provider export/import is disabled.'); };
  return {
    setContractAddress(value) { address = value; },
    async set(name, value) { states.set(id(name), value); },
    async get(name) { return states.get(id(name)) ?? null; },
    async remove(name) { states.delete(id(name)); },
    async clear() { states.clear(); },
    async setSigningKey(addr, value) { keys.set(addr, value); },
    async getSigningKey(addr) { return keys.get(addr) ?? null; },
    async removeSigningKey(addr) { keys.delete(addr); },
    async clearSigningKeys() { keys.clear(); },
    exportPrivateStates: unsupported, importPrivateStates: unsupported,
    exportSigningKeys: unsupported, importSigningKeys: unsupported,
  };
}
