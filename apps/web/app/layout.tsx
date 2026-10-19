import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const spaceGrotesk = localFont({ src: './fonts/SpaceGrotesk.ttf', weight: '300 700', display: 'swap', variable: '--font-space-grotesk' });
const themeScript = `(function(){var t;try{t=localStorage.getItem('veilpass-theme')}catch(e){}document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`;
export const metadata: Metadata = { title: 'VeilPass — Your credentials. Only your business.', description: 'Private credentials. Verifiable eligibility. Built on Midnight.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body>{children}</body></html>; }
