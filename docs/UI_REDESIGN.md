# Interface rebuild — 19 October 2026

The follow-up rebuild replaces the green dashboard-first entrance with a distinct public website and application workspace.

## Visual system

Warm ivory public surfaces, deep ink navigation, ultramarine actions, large restrained typography, editorial serif accents, and a custom code-native VeilPass mark. Shared components provide brand, website navigation and application navigation. SVG/CSS credential illustrations are labeled previews; no fabricated usage statistics, partnerships or identity data are displayed.

## Routes

- `/`: public site covering the product, workflow, privacy boundary, reference applications, SDK, FAQ and app entry.
- `/lifecycle`: credential wallet and focused policy workflow with separate request/evaluate/verify controls. Current status, expiry, issuance trust, activity and irreversible sample administration remain functional.
- `/developers`: integrated developer portal with quickstart, adapter responsibilities, policies, errors and security guidance.
- `/hackathon`, `/community`: distinct reference application experiences using the actual SDK-backed sandbox API, with real pending stages, success, failure and inspectable receipts.
- `/wallet`: retained real Midnight provider/vault workflow, moved from `/`, restyled and covered by its original browser acceptance checks. Its network/browser E2E entrypoint now opens this route.

## Interaction and responsive behavior

Mobile website and workspace menus expose their expanded state, close actions and real navigation. Policy controls use visible pressed-state buttons; there is no invisible duplicate select in the keyboard path. Test credentials, receipts and destructive sample issuer controls are expandable. Receipt copy reports actual clipboard success/failure. Challenge countdown is visual feedback only; server/contract time remains authoritative.

The layout adapts to narrow mobile, tablet and wide desktop screens. Primary application typography was enlarged and secondary text contrast strengthened. Reduced-motion preferences disable animation and smooth scrolling. No claim of a complete WCAG audit is made.

## Verification

The production build, 42 existing protocol/vault/SDK tests and strict typecheck pass. Chrome checks verify the public/mobile navigation, sample initialization, both reference applications, SDK portal and absence of horizontal overflow. The full lifecycle browser suite verifies both policies, insufficient qualification, replay and revocation. The retained wallet suite verifies issuance, encrypted persistence, wrong-passphrase rejection, unlock, missing-wallet feedback and mobile layout.

Screenshots are in `docs/screenshots/redesign`. `scripts/redesign-review.mjs` reproduces the visual review against `VEILPASS_UI_ORIGIN`. Technical boundaries remain visible: the V2 UI uses generated execution and server-known sample witnesses, even though proving/verification keys have now been generated successfully. A public deployment is not implied.
