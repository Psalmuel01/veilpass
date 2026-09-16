export function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/does not satisfy|authenticity|not approved|schema|Malformed/.test(message)) return 'Eligibility Not Verified. This credential does not satisfy the application’s authenticity and eligibility requirements.';
  if (/already authorized/.test(message)) return 'This credential has already authorized this application. Replay was rejected.';
  if (/reject|denied|cancel/i.test(message)) return 'The wallet request was declined. You can try again when ready.';
  if (/fetch|network|timeout|ECONN/i.test(message)) return 'Connection interrupted. Check your wallet, indexer and local proof server, then retry. No authorization has been confirmed.';
  const safe = ['Install a Midnight', 'Switch your wallet', 'Wallet network changed', 'Deploy the issuer', 'Contract not found', 'This credential belongs', 'A holder-controlled', 'Initialize the demo', 'The network did not', 'Authorization is not', 'Deployment was not'];
  return safe.some(prefix => message.startsWith(prefix)) ? message : 'Verification could not complete. Check the network and local proof server. No authorization has been confirmed.';
}
