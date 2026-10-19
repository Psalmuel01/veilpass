# VeilPass V2 demo video

The finished film is `docs/video/veilpass-v2-demo.mp4`: approximately 3 minutes 27 seconds, 1920×1080, 30 fps, H.264 video and stereo AAC audio. The narration uses the American English neural voice `en-US-AvaNeural` at its normal speaking rate. It includes burned-in captions, a separate SRT, chapter metadata, and a very quiet original ambient track. Media is generated locally and excluded from Git.

## What the film demonstrates

The opening introduces the redesigned dark interface and the explicitly labeled generated-execution workspace. The live section uses real browser footage from a disposable local Midnight deployment:

- A funded testkit wallet connected through the connector bridge.
- Fresh application-bound challenges and two real proof-backed transactions, one for each policy.
- Independent SDK acceptance in `confirmed-midnight` mode.
- Rejection of a reused challenge.
- An administrator-authorized on-chain revocation, followed by rejection of the earlier receipt and a fresh proof attempt.

The revocation title card represents an actual administration action executed by the integration harness; it includes its real transaction ID. `docs/video/recording-evidence.json` contains the matching deployment and transaction references. The sandbox workspace is labeled separately from the real proof flow.

The cut shortens proof waits and labels their measured click-to-confirmation times. These are observations of this local run, not performance benchmarks. Some UI frames are held to make room for narration. Credential import and setup are omitted from the edited footage. The recording uses sample credentials; raw footage remains in the ignored `.cache/video-v2/` directory.

The final card states the remaining scope: signed issuance, holder-owned keys, installed-wallet acceptance, and Preprod deployment. This is a validated local prototype with a fixed two-record batch. The film does not establish production or Preprod readiness.

## Included media

| File in `docs/video/` | Purpose |
| --- | --- |
| `veilpass-v2-demo.mp4` | Finished, shareable film with captions and chapters |
| `veilpass-v2-demo.srt` | Separate caption track |
| `poster.png` | Opening poster |
| `narration.txt` | Full narration |
| `chapters.json` | Chapter times |
| `recording-evidence.json` | Real chain/browser evidence for the recorded run |
| `media-info.json` | Codec and container information |
| `audio-production.json` | Voice, pace, music gain and loudness target |
| `american-voice-preview.mp3` | Short preview of the latest American voice |

## Reproduce on macOS

Requirements: Node 22.22+, installed project dependencies, Chrome, Docker, generated lifecycle proof artifacts, Python 3, FFmpeg/ffprobe with libx264, and `edge-tts` with network access. The demo narration text is sent to the speech service; no credential or witness data is sent. Run the existing lifecycle compilation/setup instructions first if artifacts are absent. Allow several minutes for proving and rendering. Use an available Docker context/configuration.

1. Start the product preview in a separate terminal:

   ```sh
   VEILPASS_WORKBENCH=1 npm run dev -- --port 3003
   ```

2. Capture the product UI:

   ```sh
   node scripts/video-v2/capture-product.mjs
   ```

   Override `VEILPASS_VIDEO_ORIGIN` if the preview uses another origin.

3. Build a separate production output and record the real local lifecycle:

   ```sh
   VEILPASS_BUILD_DIR=.next-video-build npm run build
   VEILPASS_BUILD_DIR=.next-video-build VEILPASS_RECORD_V2=1 VEILPASS_BROWSER_E2E=1 npm run test:lifecycle:e2e
   ```

   Recording uses port 3007 by default; `VEILPASS_LIVE_PORT` can override it. The harness starts and removes its disposable network. It updates `docs/evidence/lifecycle-network.json` with actual results. Never replace a failed recording with invented transaction evidence.

4. Generate narration, graphics, evidence overlays, and render:

   ```sh
   python3 -m venv .cache/video-voice-venv
   .cache/video-voice-venv/bin/pip install edge-tts==7.3.1
   node scripts/video-v2/prepare-assets.mjs
   node scripts/video-v2/finish-overlays.mjs
   python3 scripts/video-v2/render.py
   ```

   The default is American English at normal pace (`en-US-AvaNeural`, rate `+0%`). Set `VEILPASS_VIDEO_VOICE=en-NG-AbeoNeural` for a Nigerian alternative, `VEILPASS_VIDEO_RATE` to change pace, or `VEILPASS_EDGE_TTS` to use another executable location. Service voice availability may change; synthesis errors stop the build rather than falling back to the old voice.

   Edit `scripts/video-v2/story.mjs` to change the story. Use `prepare-assets.mjs --graphics-only` to redraw graphics while retaining existing synthesized narration and timing. Full narration changes require normal asset generation.

5. Validate playback and decode:

   ```sh
   ffprobe -v error -show_format -show_streams docs/video/veilpass-v2-demo.mp4
   ffmpeg -v error -i docs/video/veilpass-v2-demo.mp4 -f null -
   ```

   Review the complete video with sound before uploading. Check that displayed transaction references match the included evidence, all UI results are readable, and the local-network/sandbox labels remain visible.
