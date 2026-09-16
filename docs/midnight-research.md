# Midnight investigation

16 September 2026. Checked before implementation:

- [Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix)
- [Environment endpoints](https://docs.midnight.network/relnotes/network)
- [Compact releases](https://github.com/LFDT-Minokawa/compact/releases)
- [Counter example](https://github.com/midnightntwrk/example-counter)
- [DApp Connector spec](https://github.com/midnightntwrk/midnight-dapp-connector-api)

## Versions

The network-compatible baseline is Compact 0.31.1, runtime 0.16.0, Compact JS 2.5.1, Midnight.js 4.1.1, ledger v8, connector 4.0.1 and proof server 8.1.0.

Compiler 0.34 is newer but targets ledger 9, so "latest" is the wrong choice here. The counter example is a useful API reference, but its dependency versions don't match the current matrix.

## Compact

Witnesses supply private client inputs, and `disclose` marks data crossing into public ledger operations. Persistent hashing covers what's needed: a salted credential commitment, two-leaf Merkle membership and application-scoped nullifiers. Only the root, approved issuer, scope and accepted nullifiers have to be public.

Compiler output includes JS execution, ZKIR and proving and verification keys. Running the generated JS is not a zero-knowledge proof.

## Wallets and SDK

Wallets expose `connect(networkId)`, `getConfiguration`, `getShieldedAddresses`, `balanceUnsealedTransaction` and `submitTransaction` on `window.midnight[walletId]`. Addresses are Bech32m and need decoding for the Midnight.js wallet provider.

`deployContract` and `findDeployedContract` take a CompiledContract plus providers. `callTx` resolves after indexer confirmation — that's not the same as a submitted transaction, and shouldn't be treated as one.

## Prover

The prover receives witness material, so it should be holder-controlled and local. A remote prover widens the trusted computing base.

## Environments

Preprod's indexer is at `https://indexer.preprod.midnight.network/api/v4/graphql`. Standalone needs a node, compatible indexer, proof server and a funded wallet. Deployment, funding and network privacy checks have to be recorded separately from unit test results.
