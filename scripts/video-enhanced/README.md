# VeilPass motion edit

Editable Python/FFmpeg motion project, 1920×1080 at 30 fps, 180 seconds. No slideshow exporter or generated product screenshots are used. `render.py` exposes reusable typography, footage-camera, caption, flow-line, evidence, status and conceptual card-transfer components. Every frame is composed on the actual timeline. `finish.py` creates a deterministic original 120 BPM electronic score and subtle interface sounds, ducks music against speech, and exports clean and captioned versions.

## Rebuild

Install Python 3, Pillow, NumPy and FFmpeg. From the repository root:

```sh
# Unpack the accompanying source package into .cache/video-enhanced first.
python3 scripts/video-enhanced/render.py --preview
python3 scripts/video-enhanced/render.py
python3 scripts/video-enhanced/finish.py
```

Narration regeneration is optional. `narrate.py` uses the local edge-tts executable documented in that file and American English Ava. Existing final narration and its original timestamped subtitle data are included in the source package, so rendering does not need network access or credentials.

## Evidence and boundaries

Hosted UI: actual VeilPass capture dated 21 October 2026. Local credential-check screens are labeled explicitly. Chain results: actual recorded dedicated-terminal-operator Preprod execution, with public canonical recheck. No installed-wallet approval or public-browser proof completion is fabricated. The certificate graphic and issuer-to-wallet card are conceptual, visibly labeled. No production-readiness, institutional-onboarding, independent-audit or external-pilot claim is made.

The prior 3:30 baseline remains unchanged at `docs/video/final/veilpass-preprod-technical-review.mp4`. Enhanced deliverables live outside Git under the existing media ignore rule, at `docs/video/enhanced`. The source package contains the exact scripts, narration, used source frames, pinned evidence, fonts with OFL license and reproduction instructions.

## Competition length

The [official Midnight Buildathon page](https://midnight.network/hackathon/buildathon) and AKINDO listing were checked on 22 October 2026. The retrieved Buildathon summary did not establish a different video-duration cap. This edit follows the requested 2:45–3:00 range at exactly 3:00. This is not a certification of participant eligibility, wave timing or all submission rules; separate Devpost hackathons have different requirements.
