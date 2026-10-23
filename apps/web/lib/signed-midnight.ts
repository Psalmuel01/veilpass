import { proverPolicy, requireProverConsent } from "../../../packages/network/prover-policy.mjs";
import { connectWithTimeout } from "../../../packages/network/wallet-connection.mjs";
import "./bind-fetch";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js/contracts";
import { setNetworkId } from "@midnight-ntwrk/midnight-js/network-id";
import { Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {
  MidnightBech32m,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import {
  Contract,
  ledger,
  type StatusPath,
} from "../../../integrations/issuance/managed-authorization/contract/index";
import {
  witnessesV3,
  type PrivateStateV3,
} from "../../../integrations/issuance/src/contract";
import {
  hex,
  sameMethod,
  samePoint,
  sameBytes,
} from "../../../integrations/issuance/src/crypto";
import {
  fromHex,
  requestKeyV3,
  type ChallengeV3,
} from "../../../integrations/issuance/src/verifier";
import type {
  Holder,
  IssuerTrust,
} from "../../../integrations/issuance/src/index";
import { memoryPrivateStateProvider } from "../../../packages/credential/memory-provider";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js/types";
import type { Stage } from "./midnight";
export type SignedNetworkConfig = {
  network: "undeployed" | "preprod";
  contractAddress: string;
  domain: string;
  appA: string;
  appB: string;
  indexerUri: string;
  indexerWsUri: string;
  proofServer: string;
  trustedProverOrigin?: string;
  trust: IssuerTrust;
};
const compiled = CompiledContract.make("veilpass-signed-v3", Contract).pipe(
  CompiledContract.withWitnesses(witnessesV3),
  CompiledContract.withCompiledFileAssets("/zk-signed"),
);
export async function connectSignedWallet(
  id: string,
  config: SignedNetworkConfig,
) {
  const initial = window.midnight?.[id];
  if (!initial)
    throw new Error(
      "Install a Midnight wallet, then refresh wallet discovery.",
    );
  return connectWithTimeout(initial, config.network);
}
export async function proveSigned(
  api: ConnectedAPI,
  holder: Holder,
  id: string,
  path: StatusPath,
  config: SignedNetworkConfig,
  challenge: ChallengeV3,
  onStage: (stage: Stage) => void,
  consentOrigin?: string,
) {
  onStage("preparing");
  if (
    challenge.version !== 3 ||
    challenge.domain !== config.domain ||
    challenge.contractAddress !== config.contractAddress ||
    challenge.audience !==
      (challenge.policy === 1
        ? config.appA
        : challenge.policy === 2
          ? config.appB
          : "") ||
    challenge.expiresAt <= Date.now() / 1000
  )
    throw new Error(
      "V3 request context changed or expired. Request a new challenge.",
    );
  const prover = proverPolicy(config.proofServer, config.trustedProverOrigin);
  // This happens before holder.present, provider creation or any network call.
  requireProverConsent(prover, consentOrigin);
  const checkNetwork = async () => {
    if ((await api.getConfiguration()).networkId !== config.network)
      throw new Error("Wallet network changed. Reconnect before retrying.");
  };
  await checkNetwork();
  setNetworkId(config.network);
  const witness = holder.present(id, {
    domain: fromHex(challenge.domain),
    audience: fromHex(challenge.audience),
    policy: BigInt(challenge.policy),
    challenge: fromHex(challenge.nonce),
    expiresAt: BigInt(challenge.expiresAt),
  });
  const addresses = await api.getShieldedAddresses();
  const decode = (s: string, coin: boolean) =>
    /^[0-9a-f]{64}$/i.test(s)
      ? s
      : coin
        ? ShieldedCoinPublicKey.codec
            .decode(config.network, MidnightBech32m.parse(s))
            .toHexString()
        : ShieldedEncryptionPublicKey.codec
            .decode(config.network, MidnightBech32m.parse(s))
            .toHexString();
  const zkConfigProvider = new FetchZkConfigProvider<
    "authorize" | "publishStatus" | "deactivate"
  >(`${location.origin}/zk-signed`);
  const proof = httpClientProofProvider(config.proofServer, zkConfigProvider);
  const providers: MidnightProviders<
    "authorize" | "publishStatus" | "deactivate",
    string,
    PrivateStateV3
  > = {
    zkConfigProvider,
    privateStateProvider: memoryPrivateStateProvider<PrivateStateV3>(),
    publicDataProvider: indexerPublicDataProvider(
      config.indexerUri,
      config.indexerWsUri,
    ),
    proofProvider: {
      async proveTx(tx, options) {
        onStage("proving");
        return proof.proveTx(tx, options);
      },
    },
    walletProvider: {
      getCoinPublicKey: () => decode(addresses.shieldedCoinPublicKey, true),
      getEncryptionPublicKey: () =>
        decode(addresses.shieldedEncryptionPublicKey, false),
      async balanceTx(tx) {
        await checkNetwork();
        onStage("balancing");
        const balanced = await api.balanceUnsealedTransaction(
          hex(tx.serialize()),
        );
        return Transaction.deserialize(
          "signature",
          "proof",
          "binding",
          Uint8Array.from(balanced.tx.match(/../g) || [], (b) =>
            parseInt(b, 16),
          ),
        );
      },
    },
    midnightProvider: {
      async submitTx(tx) {
        await checkNetwork();
        onStage("submitting");
        await api.submitTransaction(hex(tx.serialize()));
        onStage("confirming");
        return tx.identifiers()[0];
      },
    },
  };
  const state = await providers.publicDataProvider.queryContractState(
    config.contractAddress,
  );
  if (!state) throw new Error("V3 contract not found.");
  const s = ledger(state.data);
  if (
    hex(s.networkDomain) !== config.domain ||
    !sameMethod(s.trustedIssuer, config.trust.method) ||
    !samePoint(s.trustedIssuerKey, config.trust.publicKey) ||
    !sameBytes(s.trustedRegistry, config.trust.registryId)
  )
    throw new Error("Pinned V3 deployment mismatch.");
  for (const name of ["authorize", "publishStatus", "deactivate"] as const) {
    const response = await fetch(`/zk-signed/keys/${name}.verifier`);
    if (!response.ok)
      throw new Error("Pinned V3 verifier artifacts unavailable.");
    const expected = new Uint8Array(await response.arrayBuffer()),
      actual = state.operation(name)?.verifierKey;
    if (!actual || !sameBytes(actual, expected))
      throw new Error("Pinned V3 circuit key mismatch.");
  }
  onStage("evaluating");
  const instance = await findDeployedContract(providers, {
    contractAddress: config.contractAddress,
    compiledContract: compiled,
    privateStateId: "holder",
    initialPrivateState: { witness, path, admin: new Uint8Array(32) },
  });
  const result = await instance.callTx.authorize(
    fromHex(challenge.audience),
    BigInt(challenge.policy),
    fromHex(challenge.nonce),
    witness.proof.createdAt,
    BigInt(challenge.expiresAt),
  );
  if (result.public.status !== "SucceedEntirely")
    throw new Error("V3 authorization was not accepted.");
  const confirmed = await providers.publicDataProvider.queryContractState(
    config.contractAddress,
  );
  if (
    !confirmed ||
    !ledger(confirmed.data).consumed.member(fromHex(requestKeyV3(challenge)))
  )
    throw new Error("Authorization missing from confirmed state.");
  onStage("confirmed");
  return {
    version: 3 as const,
    challengeId: challenge.id,
    transactionReference: result.public.txId,
  };
}
