import Link from 'next/link';
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link className={`vp-brand ${inverse ? 'vp-brand-inverse' : ''}`} href="/" aria-label="VeilPass home">
    <svg width="30" height="32" viewBox="0 0 30 32" fill="none" aria-hidden="true"><path d="M2 3h7l6 17L21 3h7L17 30h-4L2 3Z" fill="currentColor"/><path d="m15 20 3.7-10H12l3 10Z" fill="var(--vp-paper, #f7f6f2)" opacity=".45"/></svg>
    <span>veilpass<span className="vp-brand-period">.</span></span>
  </Link>;
}
