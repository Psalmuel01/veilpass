# Performance

`npm run benchmark:lifecycle` records generated Compact constraint evaluation and SDK verification including durable filesystem writes, 20 samples per operation. See `docs/evidence/lifecycle-benchmark.json` for actual machine, runtime, timestamps and measurements. No numbers are invented or presented as ZK proving performance.

On the recorded Apple M2 arm64 / Node 22.22.0 run, median constraint evaluation was approximately 18.7 ms, p95 20.8 ms; SDK verification median approximately 10.8 ms, p95 16.1 ms. This microbenchmark is one local run, not a comparative benchmark or service-level commitment.

Credential issuance, real V2 proof generation, network verification/confirmation, proof size and circuit/network resource measurements remain unmeasured. V2 key generation/network execution is blocked as described in deployment notes. Frontend production bundle sizes are emitted by the build; no Lighthouse/Web Vitals score is claimed.

More claims and predicates increase circuit/commitment work. The current batch is fixed at two leaves, so these measurements do not establish scalability. Workbench evaluation is server-side and exposes only pending/result states to the UI; the legacy prover is a separate holder-controlled process. Moving real holder cryptography into browser workers remains future integration work.
