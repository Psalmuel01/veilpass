'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowLeft, LayoutGrid, WalletCards, ShieldCheck, Building2, Code2, LifeBuoy, Menu, X, ChevronRight, LockKeyhole } from 'lucide-react';
import { Brand } from './brand';
import { ThemeToggle } from './theme-toggle';
import { HostedNotice } from './hosted-notice';
export function AppShell({ children, section = 'Overview', environment = 'Local sandbox' }: { children: React.ReactNode; section?: string; environment?: string }) {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(section);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const sync = () => setActiveSection(section === 'Developers' ? section : ({ '#credential': 'Credential wallet', '#verification': 'Verification', '#issuer': 'Issuer controls' } as Record<string, string>)[window.location.hash] || section);
    sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync);
  }, [section]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []);
    focusables()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const items = focusables(), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', keyboard); menuButton.current?.focus(); };
  }, [open]);
  const links = [
    {label: 'Sample lifecycle', href: '/lifecycle', icon: LayoutGrid},
    {label: 'Local proof demo', href: '/live', icon: ShieldCheck},
    {label: 'Holder wallet', href: '/holder', icon: LockKeyhole},
    {label: 'Signed issuer', href: '/issuer', icon: Building2},
    {label: 'Credential wallet', href: '/lifecycle#credential', icon: WalletCards},
    {label: 'Verification', href: '/lifecycle#verification', icon: ShieldCheck},
    {label: 'Issuer controls', href: '/lifecycle#issuer', icon: Building2},
  ];
  return <div className="vp vp-app">
    {open && <button className="vp-sidebar-backdrop" aria-label="Close navigation overlay" onClick={() => setOpen(false)}/>}
    <aside ref={sidebar} role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label="Workspace navigation" className={`vp-sidebar ${open ? 'is-open' : ''}`}>
      <Brand inverse/>
      <button className="vp-sidebar-close" onClick={() => setOpen(false)} aria-label="Close workspace navigation"><X size={20}/></button>
      <div className="vp-workspace"><span className="vp-workspace-avatar">P</span><div><strong>Personal workspace</strong><small>Developer preview</small></div><span className="vp-workspace-tag">V2</span></div>
      <div className="vp-nav-caption">WORKSPACE</div>
      <nav aria-label="Workspace navigation">{links.map(item => <Link className={`vp-sidebar-link ${activeSection === item.label ? 'is-active' : ''}`} key={item.label} href={item.href} aria-current={activeSection === item.label ? 'location' : undefined} onClick={() => { setOpen(false); setActiveSection(item.label); }}><item.icon size={18}/>{item.label}{activeSection === item.label && <span className="vp-nav-active-dot"/>}</Link>)}</nav>
      <div className="vp-nav-caption vp-nav-caption-second">BUILD WITH VEILPASS</div>
      <Link className={`vp-sidebar-link ${section === 'Developers' ? 'is-active' : ''}`} href="/developers"><Code2 size={18}/>Developer portal<ArrowUpRight size={13}/></Link>
      <Link className="vp-sidebar-link" href="/wallet"><WalletCards size={18}/>Midnight wallet<ArrowUpRight size={13}/></Link>
      <div className="vp-sidebar-bottom"><div className="vp-sidebar-privacy"><LockKeyhole size={18}/><strong>A little less disclosure.<br/>A lot more control.</strong><Link href="/#privacy">Meet the privacy model <ArrowUpRight size={14}/></Link></div><Link className="vp-sidebar-link" href="/developers#security"><LifeBuoy size={18}/>Security & support</Link><Link className="vp-sidebar-home" href="/"><ArrowLeft size={14}/> Back to website</Link></div>
    </aside>
    <div className="vp-app-body"><header className="vp-app-topbar"><button ref={menuButton} className="vp-menu-toggle" aria-label="Open workspace navigation" aria-expanded={open} onClick={() => setOpen(!open)}><Menu size={21}/></button><div className="vp-breadcrumb">Workspace <ChevronRight size={13}/><span>{section}</span></div><div className="vp-topbar-right"><ThemeToggle/><span className="vp-environment"><i/>{process.env.NEXT_PUBLIC_HOSTED_PREVIEW === '1' ? 'Public preview' : environment}</span><Link href="/wallet" className="vp-button vp-button-outline vp-button-small">Wallet demo <ArrowUpRight size={14}/></Link><span className="vp-user-avatar" aria-label="Personal workspace">P</span></div></header><HostedNotice/>{children}</div>
  </div>;
}
