# Midnight compatibility investigation — 19 October 2026

Primary sources reviewed:

- [Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix)
- [Identity](https://docs.midnight.network/concepts/identity)
- [Private contract guide](https://docs.midnight.network/guides/build-a-private-smart-contract)
- [Private state and witnesses](https://docs.midnight.network/guides/private-state-witnesses)
- [Deploy and operate](https://docs.midnight.network/guides/deploy-and-operate)
- [Official VC repository](https://github.com/midnightntwrk/midnight-verifiable-credentials)
- [0.35 release](https://docs.midnight.network/relnotes/compact/toolchain-0.35.0)

Keep the repository's matrix-compatible Compact 0.31.1 / runtime 0.16.0 / Midnight.js 4.1.1 / ledger 8.1.0 pins. Toolchain 0.35 targets ledger 9, so upgrading to npm latest is not a compatibility strategy. Installed compiler version was verified and V2 source compiled with it.

The identity documentation describes stable credential packages at 0.3.0, with 0.2.0 still appearing in older package/quickstart pages. Both target runtime 0.16.0; their ESM TypeScript tooling requires Node 24+. This repository is Node 22.22.0. Do not infer compatibility from the compiler version alone.

`credential-model` supplies family metadata/validation, `credential-compact` reusable structures and signature/proof checks, and `credential-did-midnight` optional signing-method binding. They do not replace application issuer trust, current status, server-time expiry or durable challenge consumption. Do not import retired or guessed APIs. No new library dependency or bespoke signature cryptography was added here; signed VC integration remains outstanding.

On ledger 8, cross-contract synchronous DID resolution is unavailable. DID integration would require a resolved, authenticated method plus a freshness policy; it is not required for the current constructor-pinned issuer model. A future migration should pin one exact official version under Node 24, compile its public entrypoint, exercise real signed issue/present/verify fixtures and then compose it with the status/challenge logic.

V2 uses the published `blockTimeGte` / `blockTimeLt` standard library operations. These constrain ledger execution time; local generated execution alone is not proof of network enforcement. Shared public batch validity prevents individual timestamps becoming authorization identifiers.
