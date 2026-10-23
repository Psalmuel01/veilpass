// Shared server/browser boundary. A remote prover sees private proof inputs.
// No remote endpoint is accepted without an exact operator-configured HTTPS pin.
/** @param {string} endpoint @param {string | undefined} [trustedOrigin]
 * @returns {{kind:'loopback'|'trusted-remote',origin:string,url:string}} */
export function proverPolicy(endpoint, trustedOrigin) {
 const url = new URL(endpoint);
 if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
  throw new Error('Prover must be an origin without credentials, paths or tokens.');
 const loopback = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if (loopback && ['http:','https:'].includes(url.protocol) && !trustedOrigin)
  return {kind:'loopback',origin:url.origin,url:url.origin};
 if (!trustedOrigin) throw new Error('A remote prover requires an explicit trusted HTTPS origin.');
 const pin = new URL(trustedOrigin);
 if (pin.protocol !== 'https:' || pin.username || pin.password || pin.search || pin.hash || pin.pathname !== '/' ||
     url.protocol !== 'https:' || loopback || url.origin !== pin.origin ||
     !pin.hostname.includes('.') || pin.hostname.endsWith('.localhost') || pin.hostname.endsWith('.local') ||
     pin.hostname.startsWith('[') || /^\d+(\.\d+){3}$/.test(pin.hostname))
  throw new Error('Remote prover must match the pinned public HTTPS origin.');
 return {kind:'trusted-remote',origin:url.origin,url:url.origin};
}
/** @param {ReturnType<typeof proverPolicy>} policy @param {string | undefined} consentOrigin */
export function requireProverConsent(policy, consentOrigin) {
 if (policy.kind === 'trusted-remote' && consentOrigin !== policy.origin)
  throw new Error('Consent to this trusted prover is required before preparing private proof inputs.');
}
