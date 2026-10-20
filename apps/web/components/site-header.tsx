'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="vp-site-header">
    <Brand/><ThemeToggle/>
    <button className="vp-menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="site-navigation" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button>
    <nav id="site-navigation" className={open ? 'is-open' : ''} aria-label="Website navigation">
      <Link href="/#how-it-works" onClick={() => setOpen(false)}>How it works</Link>
      <Link href="/#privacy" onClick={() => setOpen(false)}>Our approach</Link>
      <Link href="/developers">For developers</Link>
      <Link className="vp-button vp-button-ink" href="/holder">Open app <ArrowUpRight size={16}/></Link>
    </nav>
  </header>;
}
