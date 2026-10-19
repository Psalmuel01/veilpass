import Link from 'next/link';
export function HostedNotice() {
  if (process.env.NEXT_PUBLIC_HOSTED_PREVIEW !== '1') return null;
  return <aside className="vp-hosted-notice" aria-label="Public preview information"><strong>Public product preview</strong><span>Explore the interface and developer guide. Sample sessions and real Midnight proofs run in the local demo.</span><Link href="https://github.com/Psalmuel01/veilpass/blob/main/docs/LIVE_V2.md">Run the full demo ↗</Link></aside>;
}
