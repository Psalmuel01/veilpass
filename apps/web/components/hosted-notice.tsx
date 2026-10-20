import Link from 'next/link';
export function HostedNotice() {
  if (process.env.NEXT_PUBLIC_HOSTED_PREVIEW !== '1') return null;
  return <aside className="vp-hosted-notice" aria-label="Public preview information"><strong>Preprod pilot</strong><span>Holder wallets and signed issuance are available. Hosted Midnight proofs await deployment; proof demonstrations use the local network.</span><Link href="/holder">Open holder wallet ↗</Link></aside>;
}
