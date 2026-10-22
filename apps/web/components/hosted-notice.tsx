import Link from 'next/link';
export function HostedNotice() {
  if (process.env.NEXT_PUBLIC_HOSTED_PREVIEW !== '1') return null;
  return <aside className="vp-hosted-notice" aria-label="Public preview information"><strong>Preprod pilot</strong><span>Holder wallets and signed issuance are available. The V3 contract is deployed on Preprod; hosted proof acceptance is under validation and requires a holder-controlled prover.</span><Link href="/holder">Open holder wallet ↗</Link></aside>;
}
