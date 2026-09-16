// Narration and timeline for the 90-second demo.
//
// Each scene has: narration (spoken), a visual kind, and a duration in seconds.
// Durations are adjusted at build time to fit the real TTS audio, so these are
// minimums rather than exact values.
//
// Every claim here has to match what the product actually does. The recording
// is a real run against a local Midnight chain, so the narration says "local"
// and never implies a public deployment.

export const BRAND = {
  bg: '#0e1210',
  panel: '#151b18',
  ink: '#e8efe9',
  muted: '#8fa396',
  accent: '#7fb069',
  accentDim: '#3d5c3a',
  danger: '#c76a5a',
  font: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  mono: "'SF Mono', ui-monospace, 'Cascadia Code', Menlo, monospace",
};

export const SCENES = [
  {
    id: 'hook',
    kind: 'title',
    min: 9,
    narration:
      'To check if you qualify, most applications ask for your whole credential. Your student ID. Your graduation year. Everything.',
    title: 'Prove what matters.',
    subtitle: 'Keep the rest private.',
  },
  {
    id: 'problem',
    kind: 'oversharing',
    min: 10,
    narration:
      'They only needed one answer: did you graduate from an approved university in or after 2020? VeilPass sends that answer, and nothing else.',
    caption: 'One question. One answer.',
  },
  {
    id: 'credential',
    kind: 'screen',
    min: 9,
    clip: { start: 26, end: 40 },
    narration:
      'Your credential is issued once and encrypted in your own browser with a passphrase. It never reaches the application.',
    callout: 'Encrypted locally · never sent to the verifier',
  },
  {
    id: 'policy',
    kind: 'screen',
    min: 11,
    clip: { start: 55, end: 68 },
    narration:
      'Before proving anything, you see exactly what is revealed and what stays private. Student ID, exact year, and credential details stay hidden.',
    callout: 'You see the disclosure before you agree to it',
  },
  {
    id: 'circuit',
    kind: 'flow',
    min: 10,
    narration:
      'A zero-knowledge circuit on Midnight checks the issuer, the credential’s authenticity, and the graduation year, using private inputs.',
    caption: 'Private inputs in. One public answer out.',
  },
  {
    id: 'proof',
    kind: 'screen',
    min: 8,
    clip: { start: 86, end: 98 },
    narration:
      'Proof generation, wallet approval and submission are real network events, not a progress animation.',
    callout: 'Real proof · real transaction',
  },
  {
    id: 'verified',
    kind: 'still',
    min: 10,
    // The receipt is on screen for barely two seconds in the recording, since
    // the E2E screenshots it and moves straight on. The screenshot from that
    // same run holds it steady for as long as the narration needs.
    still: 'docs/screenshots/verified-local.png',
    narration:
      'The application learns one thing: the policy was satisfied. Confirmed on chain, with no credential attributes published.',
    callout: 'Eligibility verified · credential still private',
  },
  {
    id: 'rejected',
    kind: 'still',
    min: 7,
    still: 'docs/screenshots/rejected-local.png',
    narration:
      'A credential that misses the policy fails inside the circuit. The constraint is real.',
    callout: 'Ineligible credential rejected',
  },
  {
    id: 'close',
    kind: 'outro',
    min: 10,
    narration:
      'VeilPass. Built on Midnight. This walkthrough runs on a local Midnight network, with the demo’s limits documented in the repository.',
    title: 'VeilPass',
    subtitle: 'Privacy-preserving authorization on Midnight',
  },
];
