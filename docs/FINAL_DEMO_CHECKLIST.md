# Final judges' demonstration checklist

## Verified

- Real signed V3 contract deployed to public Preprod.
- Both policy authorizations and status updates confirmed; references published.
- Independent verification, durable replay rejection and revoked-circuit rejection recorded.
- Encrypted synthetic-holder recovery validated.
- Hosted Vercel interface, Render backend and Neon storage complement each other.
- Root 91 tests, signed module 39 tests, type checks and production build passed.

## Video preparation

A 3:30, 1080p30 American-voice review cut is exported locally at `docs/video/final/veilpass-preprod-technical-review.mp4`, with SRT captions, included source excerpts, narration and timeline. Technical checks measured −15.93 LUFS and −1.98 dBTP. The contact sheet was inspected; full owner playback and fresh-holder footage remain pending. Media stays outside Git under the existing ignore rule.

The editable timecoded script is `scripts/video-final/story.json`; narration generation is `scripts/video-final/narrate.py`. Voice: natural American English, Ava. Scene descriptions form the shot list. Historical hosted footage must retain its 21 October recording label; Preprod transaction evidence is from 22 October. These are two separately recorded boundaries. Do not show a fabricated wallet approval or describe local policy checks as network proofs.

Fresh holder creation needs the owner to enter a disposable vault passphrase in the browser. Automatic approval review explicitly requires user entry for a new vault credential. No password or passphrase should be sent in chat. Existing historical footage can support an honestly labeled review cut while this step is pending.

Before calling a video final: render 1920×1080 at 30 fps, verify narration timing, check every security claim against evidence, inspect captions and full-frame readability, listen to the mix, preserve music attribution/source, and review the final export. A script or generated voice track alone is not a completed video.

## Submission links

- Product: https://useveilpass.vercel.app
- Source: https://github.com/Psalmuel01/veilpass
- Protocol evidence: `docs/evidence/preprod-authorization.json`
- Deployment report: `docs/FINAL_DEPLOYMENT_REPORT.md`
- Explorer: https://preprod.midnightexplorer.com (search published references).

A public YouTube demo URL, final gallery/screenshots, verified current eligibility/deadline and owner submission remain required. No hackathon submission or public video upload has been performed by this checklist.

## Release work remaining

Hosted-browser and installed-wallet proof acceptance, a persistent trusted prover, independent review and an external issuer/two-application pilot. Do not mark the project production ready until these are addressed. Keep public proof activation off meanwhile.
