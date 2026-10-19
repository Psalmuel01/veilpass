'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ShieldCheck, LoaderCircle, LockKeyhole, CheckCheck } from 'lucide-react';
import { SiteHeader } from '../components/site-header';
export function ReferenceVerifier({ professional }: { professional: boolean }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string, unknown>>();
  const policy = professional ? 'professional-level' : 'approved-training';
  async function verify() {
    setBusy(true); setError(''); setResult(undefined);
    try {
      async function call(action: string, extra: Record<string, unknown> = {}) {
        const response = await fetch('/api/lifecycle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, policy, ...extra }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
      }
      setStage('Preparing sample qualification…'); await call('initialize');
      setStage('Requesting a fresh challenge…'); const challenge = await call('challenge');
      setStage('Evaluating qualification…'); const authorization = await call('authorize', { challengeId: challenge.result.id });
      setStage('Verifying with the SDK…'); const verified = await call('verify', { presentation: authorization.result });
      setResult(verified.result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Verification could not be completed. Please retry.'); }
    finally { setBusy(false); setStage(''); }
  }
  return <div className={`vp vp-reference-page ${professional ? 'vp-reference-community' : ''}`}>
    <SiteHeader/>
    <main className="vp-reference-main">
      <section className="vp-reference-story"><div className="vp-eyebrow">{professional ? 'THE DEVELOPER COMMONS' : 'A PLACE FOR THE NEXT BIG IDEA'}</div><h1>{professional ? <>Good people.<br/>Shared ambition.<br/><em>Your community.</em></> : <>Big ideas.<br/>Real builders.<br/><em>Your next move.</em></>}</h1><p>{professional ? 'Find a community that values what you know. Demonstrate a professional qualification, without handing over your personal record.' : 'You bring the curiosity and the drive. Your qualification takes care of the eligibility question.'}</p><div className="vp-reference-big-mark" aria-hidden="true">{professional ? 'c°' : 'H↗'}</div><small>VEILPASS REFERENCE APPLICATION / {professional ? '02' : '01'}</small></section>
      <section className="vp-reference-form-side"><span className="vp-eyebrow">A SMALL CHECK. A NEW POSSIBILITY.</span><h2>{professional ? 'You could belong here.' : 'Let’s check your qualification.'}</h2><p>{professional ? 'The community requires an approved developer qualification at professional level 2 or higher.' : 'The hackathon requires completion of an approved developer training program at level 1 or higher.'}</p><div className="vp-reference-requirement"><ShieldCheck size={24}/><div><strong>{professional ? 'Professional developer qualification' : 'Approved developer training'}</strong><small>{professional ? 'Level 2 or above · currently valid' : 'Completed program · currently valid'}</small></div></div><div className="vp-disclosure-summary"><LockKeyhole size={19}/><div><strong>Your personal record isn’t the request.</strong><p>The SDK receives an eligibility result, a policy, and a one-time reference. No applicant identity is collected by this sample.</p></div></div><button className="vp-button vp-button-blue" disabled={busy} onClick={verify}>{busy ? <LoaderCircle className="vp-spin" size={17}/> : <ArrowRight size={17}/>} {busy ? stage : 'Check sample qualification'}</button><div className="vp-reference-mode"><span><i className="vp-blue-dot"/>Local sandbox · generated execution</span>Server-known sample credential. No ZK proof or network confirmation.</div>{error && <div className="vp-alert vp-alert-error" role="alert">{error}</div>}{result && <><div className="vp-verified-result" role="status"><span className="vp-result-icon"><CheckCheck size={24}/></span><div><span className="vp-eyebrow">ONE QUESTION, ANSWERED</span><h3>Sample qualification accepted</h3><p>Your sample credential meets this application’s policy.</p></div></div><details className="vp-receipt"><summary>Inspect verification receipt <ArrowUpRight size={14}/></summary><pre>{JSON.stringify(result, null, 2)}</pre></details></>}<Link className="vp-quiet-link" href="/lifecycle#issuer">Manage the sample credential <ArrowUpRight size={14}/></Link><p className="vp-reference-mode">Both browser applications share the sandbox session. Revoke the qualification in the workspace and check again: a fresh request must fail.</p></section>
    </main>
  </div>;
}
