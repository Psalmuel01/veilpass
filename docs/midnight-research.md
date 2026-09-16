# Midnight investigation — 16 September 2026

Sources checked before implementation:
- [Official compatibility matrix](https://docs.midnight.network/relnotes/support-matrix)
- [Official environment endpoints](https://docs.midnight.network/relnotes/network)
- [Compact releases](https://github.com/LFDT-Minokawa/compact/releases)
- [Official counter example](https://github.com/midnightntwrk/example-counter)
- [DApp Connector specification](https://github.com/midnightntwrk/midnight-dapp-connector-api)

The network-compatible baseline is Compact 0.31.1, runtime 0.16.0, Compact JS 2.5.1, Midnight.js 4.1.1, ledger v8, connector 4.0.1 and proof server 8.1.0. The latest compiler, 0.34, targets ledger 9, so “latest” is inappropriate here. The older counter example is useful for APIs but its dependencies are not the current compatibility matrix.

Compact witnesses supply private client inputs. `disclose` marks data crossing into public ledger operations. Persistent hashing supports a salted credential commitment, fixed two-leaf Merkle membership and application-scoped nullifiers. Only the batch root, approved issuer, application scope and accepted nullifiers need be public.

Wallets expose `window.midnight[walletId].connect(networkId)`, getConfiguration, getShieldedAddresses, balanceUnsealedTransaction and submitTransaction. Addresses are Bech32m and must be decoded for the Midnight.js wallet provider. Midnight.js deployContract/findDeployedContract use CompiledContract and provider objects. callTx completes after indexer confirmation; it must not be equated with merely submitting a transaction.

The prover receives private witness material. Use a holder-controlled local proof server. An arbitrary remote proof server would expand the trusted computing boundary. Compiler output includes JS execution, ZKIR and proving/verification keys; executing generated JS alone is not a zero-knowledge proof.

Preprod uses https://indexer.preprod.midnight.network/api/v4/graphql. Standalone requires a node, compatible indexer, proof server and funded wallet. Docker was initially stopped; deployment/funding and actual network privacy checks must be recorded separately from unit test success.
