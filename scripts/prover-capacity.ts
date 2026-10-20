// Offline proving feasibility only. No chain, funded wallet or real credential.
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { createUnprovenDeployTxFromVerifierKeys, createUnprovenCallTxFromInitialStates } from "@midnight-ntwrk/midnight-js/contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js/network-id";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { LedgerParameters, ZswapChainState, sampleSigningKey } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { Contract, pureCircuits } from "../integrations/issuance/managed-authorization/contract/index.js";
import { witnessesV3, type PrivateStateV3 } from "../integrations/issuance/src/contract.js";
import { IssuerAuthority, Holder } from "../integrations/issuance/src/index.js";
import { ActiveStatusTree } from "../integrations/issuance/src/status-tree.js";
import { label, random32 } from "../integrations/issuance/src/crypto.js";
import path from "node:path";

const endpoint = new URL(process.env.VEILPASS_TEST_PROVER || "http://127.0.0.1:6301");
if (endpoint.hostname !== "127.0.0.1" || endpoint.protocol !== "http:" || endpoint.username || endpoint.password || endpoint.search)
  throw new Error("Capacity tests require the disposable loopback prover");
setNetworkId("undeployed");
const issuer = new IssuerAuthority(), holder = new Holder(), trust = issuer.publicTrust();
const q = issuer.issue(holder.request(issuer.approve(2, holder.publicIdentity())));
const id = holder.accept(q, trust), tree = new ActiveStatusTree(issuer.statusEntries());
const domain = label("veilpass:capacity"), audience = label("capacity.example"), other = label("other.example");
const challenge = { domain, audience, policy: 1n, challenge: random32(), expiresAt: BigInt(Math.floor(Date.now() / 1000) + 300) };
const admin = random32(), witness = holder.present(id, challenge);
const state: PrivateStateV3 = { witness, path: tree.path(id), admin };
const assets = path.resolve("integrations/issuance/managed-authorization");
const compiled = CompiledContract.make("veilpass-capacity", Contract).pipe(
  CompiledContract.withWitnesses(witnessesV3), CompiledContract.withCompiledFileAssets(assets));
const zk = new NodeZkConfigProvider<"authorize" | "publishStatus" | "deactivate">(assets);
const dummyKey = "00".repeat(32);
const deploy = await createUnprovenDeployTxFromVerifierKeys(zk, dummyKey, {
  compiledContract: compiled, initialPrivateState: state, signingKey: sampleSigningKey(),
  args: [trust.method, trust.publicKey, trust.registryId, tree.root(), pureCircuits.administratorKey(admin), domain, audience, other],
}, dummyKey);
const call = await createUnprovenCallTxFromInitialStates(zk, {
  compiledContract: compiled, circuitId: "authorize", contractAddress: deploy.public.contractAddress,
  coinPublicKey: dummyKey, initialContractState: deploy.public.initialContractState,
  initialZswapChainState: new ZswapChainState(), ledgerParameters: LedgerParameters.initialParameters(),
  initialPrivateState: state,
  args: [audience, 1n, challenge.challenge, witness.proof.createdAt, challenge.expiresAt],
}, dummyKey);
console.log("Proving an actual disposable V3 authorization; no chain submission.");
const start = Date.now();
await httpClientProofProvider(endpoint.href, zk, { timeout: 300000 }).proveTx(call.private.unprovenTx);
holder.lock();
console.log(JSON.stringify({ proofSucceeded: true, elapsedMs: Date.now() - start, submittedToChain: false }));
