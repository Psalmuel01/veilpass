import Link from 'next/link';
import { ArrowUpRight, GraduationCap, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/app-shell';
const integration = `import { createVeilPassVerifier } from './packages/sdk';
import { FileChallengeStore } from './packages/sdk/file-store';

const verifier = createVeilPassVerifier({
  audience: AUDIENCE_HEX,
  networkDomain: NETWORK_DOMAIN_HEX,
  contractAddress: PINNED_CONTRACT_HEX,
  policyId: 'approved-training',
  store: new FileChallengeStore(PRIVATE_DIRECTORY),
  chain: confirmedMidnightAdapter,
});

const challenge = await verifier.createChallenge(120);
const result = await verifier.verifyPresentation({
  version: 2,
  challengeId: challenge.id,
  transactionReference: confirmedTransactionId,
});

if (result.valid && result.eligible) {
  // Authorize one action in your authenticated application session.
}`;
export default function Developers() {
  return <AppShell section="Developers"><main className="vp-docs"><header className="vp-docs-header"><span className="vp-eyebrow">VEILPASS FOR DEVELOPERS</span><h1>A better question.<br/><span>A smaller data footprint.</span></h1><p>Build eligibility into your application with contextual challenges, explicit trust boundaries, and a focused TypeScript API.</p><nav className="vp-docs-tabs" aria-label="Documentation sections"><a href="#quickstart">Quickstart</a><a href="#integration">Integration</a><a href="#policies">Policies</a><a href="#security">Security</a></nav></header>
      <section className="vp-docs-section" id="quickstart"><h2>Start with the repository</h2><p>The SDK is an unpublished, private source package at <code>packages/sdk</code>. Compile the lifecycle bindings before using it. The package name is reserved for local development; no npm publication is claimed.</p><pre className="vp-docs-code">{`nvm use\nnpm ci\nnpm run contract:check\nnpm run lifecycle:check\nnpm test\nVEILPASS_WORKBENCH=1 npm run dev`}</pre><div className="vp-docs-callout">Node 22.22.0 · Compact 0.31.1 · runtime 0.16.0. The local sandbox runs generated circuit constraints with sample data. A real proof-backed flow requires the corresponding proof artifacts, wallet, providers, and deployed contract.</div></section>
      <section className="vp-docs-section" id="integration"><h2>Integrate a verifier</h2><p>Create a challenge on your server, have the holder authorize its exact context, and inspect the result. Eligibility authorizes a specific action; your application owns session authentication.</p><pre className="vp-docs-code">{integration}</pre><h3>Bring an authenticated chain adapter</h3><p>Default SDK mode accepts confirmed Midnight authorization only. The adapter must authenticate a successful finalized transaction at the configured contract, inspect its exact public inputs, and read current canonical status. A holder-provided transaction reference or cached Boolean does not establish verification. The supplied V2 sandbox adapter explicitly runs in generated-execution mode; the separate live adapter checks real confirmed transactions against pinned circuit verifier keys and current canonical state.</p></section>
      <section className="vp-docs-section" id="live"><h2>Run live V2 verification</h2><p>The live page imports the qualification in browser memory, generates a proof through a holder-controlled loopback prover, requests wallet approval, waits for confirmation and sends only the transaction reference to the server-side SDK.</p><pre className="vp-docs-code">{`npm run lifecycle:compile
# Docker Desktop and Chrome required
npm run demo:live
# Automated real-chain browser coverage:
npm run test:live:browser`}</pre><p>The demo launches a disposable local chain and a funded testkit wallet through a connector bridge. It opens Chrome with the sample credential loaded. Close that window to stop and dispose the chain. This does not represent an installed wallet-extension or Preprod test.</p><Link className="vp-quiet-link" href="/live">Open live verification <ArrowUpRight size={14}/></Link><h3>Bring your own deployment</h3><p>Configure the public deployment fields in <code>.private/lifecycle-public.json</code>: network, contractAddress, root, domain, appA, appB, indexerUri, indexerWsUri and proofServer. No credential or administrator secrets belong in this file. Compile the matching keys locally and deliver the credential to its holder separately. See <code>docs/LIVE_V2.md</code> for exact setup and trust boundaries.</p></section>
      <section className="vp-docs-section" id="policies"><h2>One qualification. Two policy profiles.</h2><p>Both policies require an approved issuer, current validity, completion of the approved developer program, and a fresh verifier-specific challenge.</p><div className="vp-docs-policy-grid"><div><GraduationCap size={23}/><h3>Hackathon eligibility</h3><p><code>approved-training</code><br/>Completed training at level 1 or above, bound to the hackathon audience.</p><Link className="vp-quiet-link" href="/hackathon">Open reference app <ArrowUpRight size={14}/></Link></div><div><ShieldCheck size={23}/><h3>Professional community</h3><p><code>professional-level</code><br/>The same qualification at level 2 or above, bound to the community audience.</p><Link className="vp-quiet-link" href="/community">Open reference app <ArrowUpRight size={14}/></Link></div></div><h3>Exercise the actual integration</h3><pre className="vp-docs-code">{`npm run demo:verifiers\n# Two HTTP origins, generated Compact constraints + SDK.\n# Credential reuse, wrong-verifier rejection, replay and revocation.`}</pre></section>
      <section className="vp-docs-section" id="errors"><h2>Failures with a clear next step.</h2><table><tbody>{[
        ['CHALLENGE_EXPIRED', 'Request a fresh challenge.'], ['REPLAY', 'Reject reuse. Do not repeat the authorized action.'], ['STATUS_CHANGED', 'Request a fresh authorization against current status.'], ['STALE_STATE', 'Retry after canonical state becomes available.'], ['UNCONFIRMED', 'Check transaction finality, contract and execution mode.'], ['BINDING', 'Reject audience, policy, nonce or deadline substitution.'], ['ISSUER_INACTIVE', 'Deny eligibility.'], ['MALFORMED', 'Reject incompatible presentations.'],
      ].map(([code, text]) => <tr key={code}><td>{code}</td><td>{text}</td></tr>)}</tbody></table></section>
      <section className="vp-docs-section" id="security"><h2>Privacy begins with honest boundaries.</h2><p>The SDK receives challenge IDs and authorization references, not raw credentials. V2 request hashes contain no universal holder-derived identifier. Public batches, challenge context, wallet metadata and timing can still correlate activity.</p><h3>Credential trust and custody</h3><p>The current V2 batch is authenticated through a constructor-pinned Merkle root, rather than VC signatures. Sample secrets are bearer material known by the sample issuer and sandbox server. Official signed-credential integration, holder-owned binding and scalable issuance remain in development.</p><h3>Revocation and freshness</h3><p>New authorizations check current contract status. The SDK rejects a historical authorization after it observes any batch status change. Canonical state age is bounded; an observation-to-action race remains. This does not revoke tokens another application already issued.</p><h3>Storage and session boundaries</h3><p>Challenge consumption uses atomic durable local files. Multi-host deployments need shared transactional storage. The sample workspace is local-only and expires after one hour or process restart. Its browser pages share one origin; the separate HTTP harness exercises two verifier origins. No external pilot or production deployment is implied.</p></section>
      <footer className="vp-app-footer"><span>Source guides: docs/SDK_GUIDE.md · docs/THREAT_MODEL.md</span><Link href="/lifecycle">Back to workspace →</Link></footer>
    </main></AppShell>;
}
