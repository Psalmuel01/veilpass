'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowRight, Check, ChevronRight, Fingerprint, ShieldCheck, LockKeyhole, GraduationCap, Eye, EyeOff, Wallet, X, CircleHelp, FileCheck2, Layers3, Globe2, LoaderCircle, Copy, ExternalLink, Terminal, RefreshCw } from 'lucide-react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { CredentialEnvelope } from '../../../packages/credential/index';
import { saveVault, unlockVault, hasVault, deleteVault } from '../lib/vault';
import type { Stage } from '../lib/midnight';

type Tab = 'overview' | 'credential' | 'verification' | 'privacy';
type Receipt = { txId: string; blockHeight: number; nullifier: string; network: string; contractAddress: string };
const network = process.env.NEXT_PUBLIC_NETWORK || 'preprod';
const initialAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const steps: { stage: Stage; label: string }[] = [{ stage: 'preparing', label: 'Preparing private credential' }, { stage: 'evaluating', label: 'Evaluating eligibility policy' }, { stage: 'proving', label: 'Generating zero-knowledge proof' }, { stage: 'balancing', label: 'Awaiting wallet approval' }, { stage: 'submitting', label: 'Submitting verification' }, { stage: 'confirming', label: 'Waiting for network confirmation' }, { stage: 'confirmed', label: 'Authorization confirmed' }];

export default function Home() {
  const [tab, setTab] = useState<Tab>('overview');
  const [api, setApi] = useState<ConnectedAPI>();
  const [walletName, setWalletName] = useState('');
  const [walletList, setWalletList] = useState<[string, string][]>([]);
  const [walletModal, setWalletModal] = useState(false);
  const [credential, setCredential] = useState<CredentialEnvelope>();
  const [scenario, setScenario] = useState<'valid' | 'invalid'>('valid');
  const [revealed, setRevealed] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stage, setStage] = useState<Stage>();
  const [receipt, setReceipt] = useState<Receipt>();
  const [address, setAddress] = useState(initialAddress);
  const [setup, setSetup] = useState(false);
  useEffect(() => { setSaved(hasVault()); }, []);
  function navigate(next: Tab) { setTab(next); setError(''); setNotice(''); }
  async function showWallets() {
    setWalletModal(true); setError('');
    const found = Object.entries(window.midnight ?? {}).filter(([, w]) => typeof w.connect === 'function');
    setWalletList(found.map(([id, w]) => [id, w.name]));
  }
  async function connect(id: string) {
    setBusy(true); setError('');
    try { const m = await import('../lib/midnight'); setApi(await m.connectWallet(id)); setWalletName(walletList.find(w => w[0] === id)?.[1] || 'Wallet'); setWalletModal(false); }
    catch (e) { const m = await import('../lib/midnight'); setError(m.safeError(e)); }
    finally { setBusy(false); }
  }
  async function issue() {
    setBusy(true); setError(''); setReceipt(undefined); setStage(undefined);
    try {
      if (passphrase.length < 12) throw new Error('Use a vault passphrase of at least 12 characters.');
      const response = await fetch('/api/credential', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await saveVault(data, passphrase); setCredential(data); setSaved(true); setPassphrase(''); setNotice('Credential encrypted and saved in this browser.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Credential issuance failed.'); }
    finally { setBusy(false); }
  }
  async function unlock() {
    setBusy(true); setError('');
    try { setCredential(await unlockVault(passphrase)); setPassphrase(''); setNotice('Your credential is unlocked for this session.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not unlock vault.'); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (!api) { await showWallets(); return; }
    if (!credential) { navigate('credential'); return; }
    setBusy(true); setError(''); setReceipt(undefined); setNotice('');
    try { const m = await import('../lib/midnight'); setReceipt(await m.prove(api, credential, address, setStage)); }
    catch (e) { const m = await import('../lib/midnight'); setError(m.safeError(e)); setStage(undefined); }
    finally { setBusy(false); }
  }
  async function deploy() {
    if (!api) { await showWallets(); return; }
    if (!credential) { navigate('credential'); return; }
    setBusy(true); setError('');
    try { const m = await import('../lib/midnight'); const addr = await m.deploy(api, credential, setStage); setAddress(addr); setNotice(`Issuer contract deployed. Save this address: ${addr}`); setStage(undefined); }
    catch (e) { const m = await import('../lib/midnight'); setError(m.safeError(e)); setStage(undefined); }
    finally { setBusy(false); }
  }
  const activeStep = steps.findIndex(s => s.stage === stage);
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('overview'); }}><span className="brand-mark"><Fingerprint size={23}/></span>veilpass<span className="brand-dot">.</span></a>
      <div className="workspace-label">WORKSPACE <span>WAVE 01</span></div>
      <nav aria-label="Main navigation">
        {([{ key: 'overview', label: 'Overview', icon: Layers3 }, { key: 'credential', label: 'My credential', icon: GraduationCap }, { key: 'verification', label: 'Verify eligibility', icon: ShieldCheck }, { key: 'privacy', label: 'Privacy model', icon: Fingerprint }] as const).map(item => <button key={item.key} className={`nav-item ${tab === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)} disabled={busy}><item.icon size={18}/>{item.label}{item.key === 'credential' && credential && <span className="nav-count">1</span>}</button>)}
      </nav>
      <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={20}/><strong>Your data stays yours.</strong><p>Prove eligibility.<br/>Keep your identity out of it.</p><button onClick={() => navigate('privacy')}>Explore the privacy model <ArrowUpRight size={13}/></button></div><div className="powered"><span className="midnight-mark">M▍</span><span>Built on <b>Midnight</b></span><ArrowUpRight size={13}/></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={13}/> <span>{tab === 'overview' ? 'Overview' : tab === 'credential' ? 'My credential' : tab === 'verification' ? 'Verify eligibility' : 'Privacy model'}</span></div><div className="header-actions"><span className="network"><i/>{network === 'undeployed' ? 'Local network' : 'Midnight Preprod'}</span><button className="wallet-button" onClick={showWallets} disabled={busy}><Wallet size={15}/>{api ? walletName : 'Connect wallet'}{api && <i className="connected-dot"/>}</button></div></header>
      <main>
        {error && !walletModal && <div role="alert" className="alert error"><CircleHelp size={18}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
        {notice && <div role="status" className="alert notice"><Check size={17}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16}/></button></div>}
        {tab === 'overview' && <>
          <div className="page-eyebrow"><span className="little-line"/> PRIVATE BY DESIGN. VERIFIABLE BY ANYONE.</div>
          <section className="hero"><div className="hero-copy"><h1>Prove what matters.<br/><span>Keep the rest private.</span></h1><p>Prove you meet an application’s requirements without exposing the credentials behind them. Your information stays with you.</p><div className="hero-actions"><button className="primary" onClick={() => navigate('credential')}>Launch demo <ArrowRight size={17}/></button><button className="text-button" onClick={() => navigate('privacy')}>How it works <ArrowUpRight size={15}/></button></div><div className="hero-footnote"><LockKeyhole size={12}/> Zero-knowledge verification. Minimal disclosure.</div></div>
          <div className="hero-visual" aria-label="Private credential transforms into an eligibility proof"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbital-dot"/><div className="floating-label top-label"><span/> PRIVATE INPUT</div><div className="visual-credential"><div className="visual-card-heading"><GraduationCap size={20}/><span>University credential</span><LockKeyhole size={13}/></div><div className="redacted"><i/><i/><i/></div><div className="visual-card-footer"><span>ISSUER VERIFIED</span><ShieldCheck size={15}/></div></div><div className="proof-bridge"><span/><Fingerprint size={31}/><span/></div><div className="proof-chip"><div><Check size={17}/></div><span>Eligibility, proven.<small>Only the answer. Never the data.</small></span></div><div className="floating-label bottom-label">ZERO-KNOWLEDGE PROOF <ArrowUpRight size={11}/></div></div></section>
          <section className="metrics-strip"><div><Fingerprint/><span>No credential fields<small>shared with the verifier</small></span></div><div><ShieldCheck/><span>Cryptographic assurance<small>verified by Midnight</small></span></div><div><LockKeyhole/><span>Private by default<small>disclose only what’s needed</small></span></div></section>
          <div className="section-heading"><div><span className="eyebrow">THE DEMO</span><h2>One credential. Just the proof.</h2></div><span className="subtle-tag">UNIVERSITY ELIGIBILITY</span></div>
          <section className="flow-grid">
            <button className="flow-card" onClick={() => navigate('credential')}><div className="flow-card-top"><span className="step-number">01</span><GraduationCap size={21}/></div><h3>Get your credential</h3><p>A university issues your credential.<br/>Store it in your private vault.</p><div className="flow-footer"><span>Encrypted in your browser</span><ArrowUpRight size={16}/></div></button>
            <button className="flow-card" onClick={() => navigate('verification')}><div className="flow-card-top"><span className="step-number">02</span><Fingerprint size={21}/></div><h3>Generate a private proof</h3><p>Prove you graduated in or after 2020<br/>from an approved university.</p><div className="flow-footer"><span>Computed with zero knowledge</span><ArrowUpRight size={16}/></div></button>
            <button className="flow-card" onClick={() => navigate('verification')}><div className="flow-card-top"><span className="step-number">03</span><ShieldCheck size={21}/></div><h3>Unlock eligibility</h3><p>The application receives confirmation.<br/>Your credential stays private.</p><div className="flow-footer"><span>Verified, without the oversharing</span><ArrowUpRight size={16}/></div></button>
          </section>
          <div className="disclosure-banner"><div className="banner-icon"><EyeOff size={20}/></div><div><strong>They need to know you qualify. Not your life story.</strong><p>Your student ID, exact graduation year, and credential details stay private.</p></div><button className="text-button" onClick={() => navigate('privacy')}>See what’s shared <ArrowRight size={15}/></button></div>
        </>}
        {tab === 'credential' && <>
          <PageHeading label="YOUR PRIVATE VAULT" title="Credentials, under your control." subtitle="Useful for verification. Visible only where they need to be."/>
          <div className="two-column"><section className="panel credential-panel"><div className="panel-heading"><span className="icon-box"><GraduationCap size={22}/></span><span className="subtle-tag">UNIVERSITY CREDENTIAL</span></div><h2>{credential ? credential.credential.issuer : 'Your next opportunity\nstarts with a credential.'}</h2><p className="muted">{credential ? 'UniversityCredential · Schema v1' : 'Get a sample credential from our demo university to experience private verification.'}</p><div className="credential-fields">{[['Degree', credential?.credential.degree], ['Graduation year', credential?.credential.graduationYear], ['Student ID', credential?.credential.studentId], ['Subject identifier', credential?.credential.subject]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{!credential ? '—' : revealed ? value : '••••••••••'}</strong><LockKeyhole size={12}/></div>)}</div><div className="credential-bottom"><span><LockKeyhole size={13}/>{credential ? 'Stored privately · encrypted in this browser' : saved ? 'Encrypted credential available' : 'No credential stored'}</span>{credential && <button className="text-button" onClick={() => setRevealed(!revealed)}>{revealed ? <EyeOff size={15}/> : <Eye size={15}/>} {revealed ? 'Hide' : 'Reveal'}</button>}</div>{credential && <button className="primary full" onClick={() => navigate('verification')}>Prove my eligibility <ArrowRight size={16}/></button>}</section>
          <section className="panel"><span className="eyebrow">DEMO ISSUER</span><h2>{saved && !credential ? 'Unlock your credential' : 'Try both sides of the policy.'}</h2><p className="muted">These are sample credentials, not real academic records. The issuer knows their contents.</p>{(!saved || credential) && <div className="scenario-picker"><button className={scenario === 'valid' ? 'selected' : ''} onClick={() => setScenario('valid')} disabled={busy}><span><Check size={17}/> Eligible graduate</span><small>Approved university · Class of 2024</small></button><button className={scenario === 'invalid' ? 'selected' : ''} onClick={() => setScenario('invalid')} disabled={busy}><span><X size={17}/> Ineligible graduate</span><small>Approved university · Class of 2018</small></button></div>}<label className="input-label" htmlFor="passphrase">Vault passphrase</label><input id="passphrase" type="password" autoComplete="off" placeholder="At least 12 characters" value={passphrase} onChange={e => setPassphrase(e.target.value)} disabled={busy}/><p className="input-help">Your passphrase encrypts the credential locally. It never leaves your browser and cannot be recovered.</p><button className="primary full" onClick={saved && !credential ? unlock : issue} disabled={busy || passphrase.length < 12}>{busy ? <LoaderCircle className="spin" size={16}/> : <LockKeyhole size={16}/>} {saved && !credential ? 'Unlock private vault' : credential ? 'Replace with demo credential' : 'Get Demo Credential'}</button>{saved && <button className="text-button full quiet" disabled={busy} onClick={() => { if (credential) { setCredential(undefined); setRevealed(false); setReceipt(undefined); setStage(undefined); } else { deleteVault(); setSaved(false); } }}>{credential ? 'Lock vault' : 'Remove encrypted demo credential'}</button>}</section></div>
          <div className="info-strip"><ShieldCheck size={18}/><p>Private storage uses AES-256-GCM encryption. While unlocked, your credential lives in this browser’s memory. A local proof server is trusted to process it.</p></div>
        </>}
        {tab === 'verification' && <>
          <PageHeading label="MINIMUM DISCLOSURE. MAXIMUM CERTAINTY." title="An answer. Not your identity." subtitle="Review the requirement and exactly what you’re sharing before you prove."/>
          <div className="two-column"><section className="panel"><div className="panel-heading"><span className="icon-box"><FileCheck2 size={22}/></span><span className="subtle-tag">POLICY · GRADUATE_2020_V1</span></div><h2>Eligibility requirement</h2><p className="policy-description">Prove that you hold a credential from an approved university and graduated in or after 2020.</p><div className="policy-rule"><Check size={15}/><span>Issuer is an approved university</span><span className="rule-label">AND</span></div><div className="policy-rule"><Check size={15}/><span>Graduation year ≥ 2020</span></div><hr/><div className="disclosure-columns"><div><h4><Eye size={14}/> What will be revealed</h4><p><Check size={13}/> Policy satisfied</p><p><Check size={13}/> Application nullifier</p></div><div><h4><EyeOff size={14}/> What stays private</h4><p><LockKeyhole size={12}/> Student ID</p><p><LockKeyhole size={12}/> Exact graduation year</p><p><LockKeyhole size={12}/> Credential details</p></div></div><button className="primary full" onClick={generate} disabled={busy || !!receipt}>{busy ? <LoaderCircle size={17} className="spin"/> : <Fingerprint size={19}/>} {receipt ? 'Authorization confirmed' : !credential ? 'Get a credential first' : !api ? 'Connect wallet to continue' : 'Generate Private Proof'}</button><p className="input-help centered">{!address ? 'Issuer deployment required before verification.' : 'Proof generation runs on your local Midnight proof server.'}</p></section>
          <section className={`panel progress-panel ${receipt ? 'success-panel' : ''}`} aria-live="polite">{receipt ? <><span className="success-icon"><ShieldCheck size={33}/></span><span className="eyebrow">PROOF ACCEPTED</span><h2>Eligibility Verified</h2><p className="muted">You proved you satisfy this application’s requirements without revealing your underlying credential.</p><dl className="receipt"><dt>Status</dt><dd className="green">Confirmed on chain</dd><dt>Network</dt><dd>{receipt.network}</dd><dt>Policy</dt><dd>GRADUATE_2020_V1</dd><dt>Block</dt><dd>{receipt.blockHeight}</dd><dt>Transaction</dt><dd className="mono break-all">{receipt.txId}</dd></dl>{receipt.network === 'preprod' && <a className="text-button" href={`https://preprod.midnightexplorer.com/tx/${receipt.txId}`} target="_blank" rel="noreferrer">View public transaction <ExternalLink size={14}/></a>}</> : <><span className="eyebrow">PROOF LIFECYCLE</span><h2>{busy ? 'Privacy, in progress.' : error ? 'Verification paused.' : 'Ready when you are.'}</h2><p className="muted">Each step follows a real computation or network event. No simulated confirmations.</p><ol className="proof-steps">{steps.map((s, i) => <li key={s.stage} className={stage && i < activeStep ? 'complete' : stage && i === activeStep ? 'current' : ''}><span>{stage && i < activeStep ? <Check size={13}/> : stage && i === activeStep ? <LoaderCircle className="spin" size={13}/> : String(i + 1).padStart(2, '0')}</span>{s.label}</li>)}</ol><div className="progress-foot"><LockKeyhole size={13}/> Your credential never goes to the verifier.</div></>}</section></div>
          <details className="setup-details" open={setup} onToggle={e => setSetup(e.currentTarget.open)}><summary><Terminal size={15}/> Developer setup <ChevronRight size={14}/></summary><div><p>Deploy the demo issuer’s fixed credential batch once using a funded {network} wallet and local proof server. This creates a real contract; allow wallet transaction prompts. The deployed contract address is the verifier’s trust anchor.</p><label className="input-label" htmlFor="contract-address">Trusted contract address</label><input id="contract-address" className="mono" value={address} onChange={e => { setAddress(e.target.value); setReceipt(undefined); }} placeholder="64-character contract address" disabled={busy}/><button className="secondary" onClick={deploy} disabled={busy || !credential}>Deploy demo issuer batch <ArrowUpRight size={15}/></button><p className="input-help">Save the deployed address as NEXT_PUBLIC_CONTRACT_ADDRESS in apps/web/.env.local for future sessions.</p></div></details>
        </>}
        {tab === 'privacy' && <>
          <PageHeading label="TRANSPARENCY ABOUT PRIVACY" title="Less revealed. More in your hands." subtitle="What is private, what is public, and who you are trusting."/>
          <section className="panel"><h2>Know where your information goes.</h2><div className="privacy-flow"><span><GraduationCap/>Demo issuer</span><ArrowRight/><span><LockKeyhole/>Encrypted holder vault</span><ArrowRight/><span><Fingerprint/>Local prover</span><ArrowRight/><span><ShieldCheck/>Midnight verifier</span></div><table><thead><tr><th>Information</th><th>Visibility</th><th>Where it lives</th></tr></thead><tbody>{[['Student ID & subject', 'Private', 'Issuer, holder, trusted local prover'], ['Exact graduation year & degree', 'Private', 'Issuer, holder, trusted local prover'], ['Credential secret & membership path', 'Private', 'Issuer, holder, trusted local prover'], ['Issuer batch root & application policy', 'Public', 'Contract state'], ['Eligibility result & nullifier', 'Public', 'Confirmed contract state'], ['Transaction metadata', 'Public', 'Midnight network']].map(row => <tr key={row[0]}><td>{row[0]}</td><td><span className={`visibility ${row[1] === 'Private' ? 'private' : ''}`}>{row[1] === 'Private' ? <LockKeyhole size={11}/> : <Globe2 size={11}/>} {row[1]}</span></td><td>{row[2]}</td></tr>)}</tbody></table></section>
          <div className="two-column privacy-assumptions"><section className="panel"><ShieldCheck size={23}/><h3>What the protocol checks</h3><p>Compact checks issuer approval, membership in the issuer’s committed batch, the graduation-year threshold, and a fresh application-scoped nullifier. Changing a credential field invalidates its commitment.</p></section><section className="panel"><CircleHelp size={23}/><h3>What this demo trusts</h3><p>The issuer knows and distributes two shared sample credentials. The frontend, browser and local proof server handle plaintext while proving. Credentials are bearer credentials; this demo does not establish a person’s identity or prevent voluntary sharing.</p></section></div><div className="info-strip"><Eye size={18}/><p>Timing and transaction metadata remain observable. A tiny demo batch does not provide a large anonymity set. Local tests and transaction inspection are evidence, not a production security audit.</p></div>
        </>}
        <footer><span>VEILPASS <span className="footer-divider">/</span> Privacy-preserving authorization</span><span><i/> Wave 1 · Developer preview</span></footer>
      </main>
    </div>
    {walletModal && <div className="modal-backdrop" onClick={() => !busy && setWalletModal(false)}><section role="dialog" aria-modal="true" aria-labelledby="wallet-title" className="wallet-modal" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close wallet selection" onClick={() => setWalletModal(false)} disabled={busy}><X size={19}/></button><span className="icon-box"><Wallet size={23}/></span><h2 id="wallet-title">Connect your wallet</h2><p className="muted">Choose a Midnight wallet on {network}. Your credential is stored separately in your private vault.</p>{error && <div role="alert" className="alert error">{error}</div>}{walletList.length ? walletList.map(([id, name]) => <button key={id} className="secondary full" disabled={busy} onClick={() => connect(id)}>{name}{busy ? <LoaderCircle className="spin" size={16}/> : <ArrowRight size={16}/>}</button>) : <div className="empty-wallet"><Wallet size={26}/><h3>No Midnight wallet detected</h3><p>Install a compatible wallet such as Lace, enable it for this site, and choose the {network} network.</p><a href="https://www.lace.io/" target="_blank" rel="noreferrer" className="text-button">Get Lace <ExternalLink size={14}/></a><button className="secondary full" onClick={showWallets}><RefreshCw size={15}/> Check again</button></div>}</section></div>}
  </div>;
}
function PageHeading({ label, title, subtitle }: { label: string; title: string; subtitle: string }) { return <div className="page-heading"><span className="eyebrow">{label}</span><h1>{title}</h1><p>{subtitle}</p></div>; }
