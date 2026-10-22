/** Bound installed-wallet requests; a late response never triggers a transaction. */
export async function connectWithTimeout(initial, network, onStatus = (_message) => {}, timeoutMs = 120000) {
  if (!initial || typeof initial.connect !== 'function') throw Error('Install or enable a Midnight wallet, then refresh.');
  async function bounded(operation, message, deadline = timeoutMs) {
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(message)), deadline);
      })]);
    } catch (error) {
      if (typeof error?.message === 'string' && error.message.includes('midnight-authenticator') && error.message.includes('shutdown'))
        throw Error('Lace closed its authentication channel. Reopen Lace, close stale approval windows, then reconnect.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  onStatus('Waiting for wallet connection approval…');
  const api = await bounded(() => initial.connect(network), 'The wallet did not complete connection. Close any pending wallet popup, refresh this page, then reconnect.');
  onStatus('Connected. Checking the wallet network…');
  const config = await bounded(() => api.getConfiguration(), 'The wallet connected but did not return its network configuration. Refresh the wallet and reconnect.', Math.min(timeoutMs, 30000));
  if (config.networkId !== network) throw Error(`Switch your wallet to ${network}, then reconnect.`);
  onStatus(`Wallet connected on ${network}.`);
  return api;
}
