# Hosted judges’ demo

The updated film is `docs/video/hosted/veilpass-hosted-demo-american.mp4` (2:31, 1080p). Rendered media and temporary recordings are ignored by Git.

This is an automated, scripted recording of the actual deployed website at https://useveilpass.vercel.app, backed by Render and Neon. It uses a disposable synthetic holder. Issuer approval and revocation are performed through the authenticated hosted API outside the recorded browser; operator secrets are never typed into the film. The test credential is left revoked.

The film demonstrates holder key creation, signed issuance, two local signature/eligibility checks, encrypted backup, lock/unlock, and rejection after revocation. Local browser checks are explicitly distinguished from Midnight network proofs. Public Preprod proof deployment remains pending. Some waits are shortened and frames held to match narration; the interface is not fabricated.

## Reproduction

Requirements: Python with Pillow, ffmpeg/ffprobe, Node with `@playwright/test`, installed Chrome, and `edge-tts` at `.cache/video-voice-venv/bin/edge-tts`. Capture requires the authorized operator configuration in the ignored `.private/hosted-preprod/render.env`; never commit or publish it.

From the repository root:

```sh
python3 scripts/video-hosted/narrate.py
node scripts/video-hosted/capture-hosted.mjs
python3 scripts/video-hosted/render.py
```

Narration uses Microsoft’s American `en-US-AvaNeural` voice at -2% speed. Only the public narration script is sent for speech generation. Speech boundary timestamps produce the captions. The renderer burns captions, adds chapters, and normalizes narration without background music.

Publish only the finished MP4, optional SRT, and poster. Do not publish raw browser caches, encrypted demo backups, private environment files, or unrelated native screen recordings. `validation.json` beside the finished video records full decode validation, duration, chapter count, and measured audio levels.

Vercel is the canonical website, Render serves backend APIs, and Neon stores encrypted authority state. Render page routes redirect to Vercel; API routes remain available for Vercel’s proxy.
