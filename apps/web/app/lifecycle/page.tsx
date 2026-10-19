'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Check, ShieldCheck, Fingerprint, LockKeyhole, LoaderCircle, GraduationCap, Ban, ChevronRight, X, Copy, CircleHelp, Plus, CheckCheck, Clock3, Building2 } from 'lucide-react';
import { AppShell } from '../../components/app-shell';
import { Brand } from '../../components/brand';

type Policy = 'approved-training' | 'professional-level';
type Presentation = { version: 2; challengeId: string; transactionReference: string; executionMs: number };
type Challenge = { id: string; nonce: string; audience: string; policyId: Policy; expiresAt: number };
type Result = { valid: boolean; eligible: boolean; policyId: Policy; verificationReference: string; mode: string };
type View = { issuer: string; credential: { level: number; expiresAt: number }; state: { statusVersion: string; issuerActive: boolean }; authorizationCount: number; requests: Challenge[] };
type Activity = { label: string; time: string; type: string };
const labels: Record<string, string> = { initialize: 'Sample credential received', challenge: 'Verification request created', authorize: 'Qualification evaluated', verify: 'Eligibility verified by SDK', revoke: 'Qualification revoked', deactivate: 'Sample issuer deactivated' };

export default function Lifecycle() {
  const [view, setView] = useState<View>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<Policy>('approved-training');
  const [challenge, setChallenge] = useState<Challenge>();
  const [presentation, setPresentation] = useState<Presentation>();
  const [result, setResult] = useState<Result>();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [basic, setBasic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!challenge) { setRemaining(0); return; }
    const update = () => setRemaining(Math.max(0, challenge.expiresAt - Math.floor(Date.now() / 1000)));
    update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [challenge]);

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setBusy(name); setError(''); setResult(undefined); setCopied(false);
    try {
      const response = await fetch('/api/lifecycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, policy, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setView(data);
      if (name === 'challenge') { setChallenge(data.result); setPresentation(undefined); }
      if (name === 'authorize') setPresentation(data.result);
      if (name === 'verify') setResult(data.result);
      setActivity(previous => [{ label: labels[name] || name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: name }, ...previous].slice(0, 8));
    } catch (e) { setError(e instanceof Error ? e.message : 'The action could not be completed. Please retry.'); }
    finally { setBusy(''); }
  }
  function choosePolicy(next: Policy) { setPolicy(next); setChallenge(undefined); setPresentation(undefined); setResult(undefined); setError(''); }
  async function copyResult() {
    try { await navigator.clipboard.writeText(JSON.stringify(result, null, 2)); setCopied(true); }
    catch { setError('Clipboard access is unavailable. You can select the receipt text to copy it.'); }
  }
  const revoked = Boolean(view?.state.statusVersion.startsWith('1:'));
  const status = revoked ? 'Revoked' : view && !view.state.issuerActive ? 'Issuer inactive' : 'Active';
  const currentStep = result ? 3 : presentation ? 2 : challenge ? 1 : 0;

  return <AppShell>
    <main className="vp-dashboard">
      <div className="vp-page-heading"><div><div className="vp-eyebrow">YOUR QUALIFICATIONS. YOUR POSSIBILITIES.</div><h1>Good credentials.<br/><span>Great opportunities.</span></h1><p>A little less disclosure. A lot more control over what comes next.</p></div><Link className="vp-button vp-button-outline" href="/developers">Developer guide <ArrowUpRight size={16}/></Link></div>
      <div className="vp-sandbox-note"><span><span className="vp-blue-dot"/><strong>Sample workspace</strong><span>Generated circuit execution · no ZK proof or network transaction</span></span><details><summary>What this means <CircleHelp size={14}/></summary><p>This local server runs the actual compiled Compact constraints and verifier SDK with server-known sample witnesses. Use sample data only. Use <Link href="/live">live V2 verification</Link> for real proofs against a configured deployment. The <Link href="/wallet">original wallet demo</Link> is also preserved.</p></details></div>
      {error && <div className="vp-alert vp-alert-error" role="alert"><CircleHelp size={18}/><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={17}/></button></div>}
      <section className="vp-wallet-section" id="credential">
        <div className="vp-section-title"><h2>Your credential wallet <span>{view ? '01' : '00'}</span></h2><span className="vp-text-muted"><LockKeyhole size={13}/> Sample data only</span></div>
        {!view ? <div className="vp-wallet-empty"><div className="vp-empty-credential-art" aria-hidden="true"><div><Fingerprint size={34} strokeWidth={1.2}/><span>YOUR NEXT CHAPTER</span></div><div/><div/></div><div><span className="vp-eyebrow">A QUALIFICATION IS A STARTING POINT</span><h2>Your next opportunity<br/>starts here.</h2><p>Receive a sample developer qualification, try it in two applications, and see exactly what each verifier learns.</p><button className="vp-button vp-button-blue" disabled={!!busy || process.env.NEXT_PUBLIC_HOSTED_PREVIEW === '1'} onClick={() => action('initialize')}>{busy ? <LoaderCircle className="vp-spin" size={17}/> : <Plus size={17}/>} {process.env.NEXT_PUBLIC_HOSTED_PREVIEW === '1' ? 'Run the local demo to initialize' : 'Initialize sample lifecycle'}</button><small>Local session · expires after one hour or server restart</small></div></div> : <div className="vp-wallet-layout">
          <div className={`vp-qualification-card ${revoked ? 'is-revoked' : ''}`}><div className="vp-qualification-top"><Brand inverse/><span className="vp-card-type">SAMPLE CREDENTIAL</span></div><div className="vp-qualification-middle"><div><span>PROFESSIONAL QUALIFICATION</span><h2>Developer<br/>training.</h2></div><Fingerprint size={84} strokeWidth={.85}/></div><div className="vp-qualification-bottom"><span>{view.issuer}<strong>Level {view.credential.level} · Professional</strong></span><span><LockKeyhole size={15}/> Held with care</span></div></div>
          <div className="vp-credential-summary"><div className="vp-credential-summary-title"><span className="vp-eyebrow">QUALIFICATION OVERVIEW</span><span className={`vp-badge ${revoked || !view.state.issuerActive ? 'vp-badge-red' : 'vp-badge-green'}`}><i/>{status}</span></div><h3>Ready for what’s next.</h3><p>Your sample qualification can satisfy two different application policies.</p><dl><div><dt>Credential type</dt><dd>Developer training</dd></div><div><dt>Qualification level</dt><dd>Professional · Level {view.credential.level}</dd></div><div><dt>Batch expiry</dt><dd>{new Date(view.credential.expiresAt * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div><div><dt>Trusted issuer</dt><dd>{view.issuer}</dd></div></dl><a href="#verification" className="vp-quiet-link">Put your qualification to work <ArrowRight size={15}/></a></div>
        </div>}
      </section>
      <div className="vp-dashboard-columns">
        <div className="vp-main-column">
          <section className="vp-verification-panel" id="verification"><div className="vp-section-title"><div><span className="vp-eyebrow">A PRECISE QUESTION. A PRIVATE ANSWER.</span><h2>Where will you go next?</h2></div><ShieldCheck size={22}/></div><p className="vp-panel-intro">Choose an application. We’ll check only the qualification it requires.</p>
            <div className="vp-policy-options" role="group" aria-label="Choose an application"><button aria-pressed={policy === 'approved-training'} disabled={!!busy} className={policy === 'approved-training' ? 'is-selected' : ''} onClick={() => choosePolicy('approved-training')}><span className="vp-app-monogram">H↗</span><strong>Hackathon entry<small>Approved developer training</small></strong><span className="vp-radio">{policy === 'approved-training' && <span/>}</span></button><button aria-pressed={policy === 'professional-level'} disabled={!!busy} className={policy === 'professional-level' ? 'is-selected' : ''} onClick={() => choosePolicy('professional-level')}><span className="vp-app-monogram vp-app-monogram-lilac">c°</span><strong>Community access<small>Professional level 2 or higher</small></strong><span className="vp-radio">{policy === 'professional-level' && <span/>}</span></button></div>
            <div className="vp-disclosure-summary"><EyeOffIcon/><div><strong>One answer. No personal record.</strong><p>The SDK receives eligibility, policy, and a one-time reference. No holder secret or stable holder identifier.</p></div></div>
            <div className="vp-process" aria-label="Verification progress">{['Request','Evaluate','Verify'].map((name, index) => <div key={name} className={currentStep > index ? 'is-done' : currentStep === index ? 'is-current' : ''}><span>{currentStep > index ? <Check size={13}/> : index + 1}</span><strong>{name}</strong>{index < 2 && <i/>}</div>)}</div>
            {!view && <div className="vp-verification-placeholder"><LockKeyhole size={17}/><span>Receive your sample credential to begin.</span><a href="#credential">Go to wallet <ArrowUpRight size={14}/></a></div>}
            {view && <div className="vp-verification-actions"><button className="vp-button vp-button-outline" disabled={!!busy} onClick={() => action('challenge')}>{busy === 'challenge' ? <LoaderCircle className="vp-spin" size={16}/> : <Plus size={16}/>} 1. Request a fresh challenge</button><button className="vp-button vp-button-outline" disabled={!!busy || !challenge} onClick={() => action('authorize', { challengeId: challenge?.id, basic })}>{busy === 'authorize' ? <LoaderCircle className="vp-spin" size={16}/> : <Fingerprint size={17}/>} 2. Evaluate Compact constraints</button><button className="vp-button vp-button-blue" disabled={!!busy || !presentation} onClick={() => action('verify', { presentation })}>{busy === 'verify' ? <LoaderCircle className="vp-spin" size={16}/> : <ShieldCheck size={17}/>} 3. Verify with SDK <ArrowRight size={16}/></button></div>}
            {challenge && <div className="vp-challenge-row"><span><Clock3 size={13}/>{remaining > 0 ? `${remaining}s remaining` : 'Challenge window ended'}</span><code>{challenge.id.slice(0, 12)}…</code><span>Server enforces expiry</span></div>}
            {presentation && <p className="vp-execution-note"><Check size={14}/> Constraints accepted in {presentation.executionMs.toFixed(1)} ms. No proof generated.</p>}
            {result && <div className="vp-verified-result" role="status"><span className="vp-result-icon"><CheckCheck size={25}/></span><div><span className="vp-eyebrow">THE ANSWER IS YES</span><h3>Eligible</h3><p>{policy === 'approved-training' ? 'Your sample qualification meets the hackathon policy.' : 'Your sample qualification meets the professional policy.'}</p><small>SDK verified · generated execution</small></div></div>}
            {result && <details className="vp-receipt"><summary>View verification receipt <ChevronRight size={15}/></summary><button className="vp-quiet-link" onClick={copyResult}><Copy size={13}/>{copied ? 'Copied' : 'Copy receipt'}</button><pre>{JSON.stringify(result, null, 2)}</pre></details>}
            <details className="vp-test-controls"><summary>Try a different qualification <Plus size={14}/></summary><label><input type="checkbox" checked={basic} disabled={!!busy} onChange={e => { setBasic(e.target.checked); setPresentation(undefined); setResult(undefined); }}/> Test level 1 credential</label><p>Level 1 meets the hackathon requirement and fails the professional policy. Request and evaluate a fresh challenge after changing credentials.</p></details>
          </section>
          <section className="vp-reference-apps"><div className="vp-section-title"><h2>Explore the applications</h2><span className="vp-eyebrow">REFERENCE INTEGRATIONS</span></div><div><Link href="/hackathon"><span className="vp-app-monogram">H↗</span><span><strong>A place for builders</strong><small>Hackathon eligibility</small></span><ArrowUpRight size={18}/></Link><Link href="/community"><span className="vp-app-monogram vp-app-monogram-lilac">c°</span><span><strong>Find your people</strong><small>Professional community</small></span><ArrowUpRight size={18}/></Link></div><p>Sample applications on this origin. A separate SDK harness tests two HTTP origins.</p></section>
        </div>
        <aside className="vp-right-column">
          <section className="vp-issuer-panel" id="issuer"><div className="vp-section-title"><span className="vp-eyebrow">ISSUER CONTROLS</span><Building2 size={18}/></div><div className="vp-issuer-avatar"><GraduationCap size={24}/></div><h2>Trusted at the source.</h2><p>{view?.issuer || 'VeilPass Sample Academy'}</p><div className="vp-issuer-status"><span>Trust model</span><strong>Pinned issuer batch</strong></div><div className="vp-issuer-status"><span>Issuer status</span><strong>{view ? view.state.issuerActive ? 'Active' : 'Inactive' : 'Not initialized'}</strong></div><p className="vp-small-copy">A fixed two-credential batch. Signed VCs and per-user issuance are still in development.</p><details className="vp-issuer-management"><summary>Manage sample qualification <ChevronRight size={14}/></summary><p>Revocation is permanent for this sample session. New requests in both applications will fail.</p><button className="vp-button vp-button-danger" disabled={!!busy || !view || revoked} onClick={() => action('revoke')}><Ban size={15}/> Revoke qualification</button><button className="vp-quiet-link vp-danger-link" disabled={!!busy || !view || !view.state.issuerActive} onClick={() => action('deactivate')}>Deactivate sample issuer</button></details></section>
          <section className="vp-activity-panel"><div className="vp-section-title"><h2>Recent activity</h2><span>{activity.length.toString().padStart(2, '0')}</span></div>{activity.length ? <ol aria-live="polite">{activity.map((item, index) => <li key={`${item.type}-${index}`}><span className={`vp-activity-icon ${item.type === 'revoke' || item.type === 'deactivate' ? 'is-negative' : ''}`}>{item.type === 'verify' ? <ShieldCheck size={14}/> : item.type === 'revoke' ? <Ban size={14}/> : <Check size={14}/>}</span><div><strong>{item.label}</strong><small>{item.time} · This session</small></div></li>)}</ol> : <div className="vp-activity-empty"><Clock3 size={22}/><p>A fresh start.</p><span>Your session activity will appear here.</span></div>}</section>
          <Link href="/developers" className="vp-developer-tip"><CodeBrackets/><span>Building something?<strong>Make eligibility part<br/>of your application.</strong><span>Explore the SDK <ArrowUpRight size={14}/></span></span></Link>
        </aside>
      </div>
      <footer className="vp-app-footer"><span>Prove what qualifies you. Reveal nothing else.</span><span>VeilPass · Developer preview</span></footer>
    </main>
  </AppShell>;
}
function EyeOffIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2C10.5 5.1 11.2 5 12 5c6 0 10 7 10 7a19 19 0 0 1-3.3 3.9M6.3 6.3A21 21 0 0 0 2 12s4 7 10 7c1.7 0 3.3-.6 4.7-1.3"/></svg>; }
function CodeBrackets() { return <span className="vp-code-brackets">{'{ }'}</span>; }
