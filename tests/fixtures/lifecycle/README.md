Public verification-key fixtures generated from `contracts/lifecycle/lifecycle.compact`
with Compact 0.31.1/runtime 0.16.0 on 19 October 2026. These small fixtures let
adapter regression tests run without regenerating proving assets. They contain
no holder/admin secrets or proving keys. Production uses the actual deployment's
locally compiled keys from `contracts/lifecycle/managed/keys`, never these fixtures.
Artifact hashes and source hash: `docs/evidence/lifecycle-artifacts.json`.

`confirmed.json` contains one public transaction and post-action state captured
from the disposable local Midnight network during the live integration on
19 October 2026. It includes a real proof and public development-wallet metadata;
no seed, administrator secret or credential witness. The tests deserialize its
actual ledger-v8 wire format. The indexer transport is mocked in these tests;
full chain verification is separately exercised by test:live:browser.
