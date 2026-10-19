'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === 'dark');
    const system = matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => { let saved; try { saved = localStorage.getItem('veilpass-theme'); } catch {} if (saved !== 'light' && saved !== 'dark') document.documentElement.dataset.theme = system.matches ? 'dark' : 'light'; sync(); };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const storage = (event: StorageEvent) => { if (event.key === 'veilpass-theme') { if (event.newValue === 'light' || event.newValue === 'dark') document.documentElement.dataset.theme = event.newValue; else followSystem(); sync(); } };
    sync(); system.addEventListener('change', followSystem); window.addEventListener('storage', storage);
    return () => { observer.disconnect(); system.removeEventListener('change', followSystem); window.removeEventListener('storage', storage); };
  }, []);
  return <button type="button" className="vp-theme-toggle" aria-label="Dark mode" aria-pressed={dark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; setDark(next === 'dark'); try { localStorage.setItem('veilpass-theme', next); } catch {} }}><Sun className="vp-theme-sun" size={17}/><Moon className="vp-theme-moon" size={17}/></button>;
}
