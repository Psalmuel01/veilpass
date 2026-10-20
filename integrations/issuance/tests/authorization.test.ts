import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import { IssuerAuthority, Holder } from "../src/index.js";
import { label, random32 } from "../src/crypto.js";
import { ActiveStatusTree } from "../src/status-tree.js";
import {
  Contract,
  pureCircuits,
  ledger,
} from "../managed-authorization/contract/index.js";
const now = 1800000000;
function fixture(level: 1 | 2 = 2) {
  const issuer = new IssuerAuthority(() => now),
    holder = new Holder(() => now);
  const q = issuer.issue(
      holder.request(issuer.approve(level, holder.publicIdentity())),
    ),
    trust = issuer.publicTrust(),
    id = holder.accept(q, trust);
  const admin = random32(),
    domain = label("veilpass:signed:v3"),
    audience = label("hackathon.example"),
    appB = label("community.example");
  const tree = new ActiveStatusTree(issuer.statusEntries());
  const challenge = {
    domain,
    audience,
    policy: 1n,
    challenge: random32(),
    expiresAt: BigInt(now + 120),
  };
  const witness = holder.present(id, challenge);
  const state = { witness, path: tree.path(id), admin };
  const contract = new Contract<typeof state>({
    signedCredential: ({ privateState }) => [
      privateState,
      privateState.witness.qualification.credential,
    ],
    privateClaims: ({ privateState }) => [
      privateState,
      privateState.witness.qualification.claims,
    ],
    issuerSignature: ({ privateState }) => [
      privateState,
      privateState.witness.qualification.proof,
    ],
    signedPresentation: ({ privateState }) => [
      privateState,
      privateState.witness.presentation,
    ],
    holderSignature: ({ privateState }) => [
      privateState,
      privateState.witness.proof,
    ],
    currentStatusPath: ({ privateState }) => [privateState, privateState.path],
    administratorSecret: ({ privateState }) => [
      privateState,
      privateState.admin,
    ],
  });
  const initial = contract.initialState(
    createConstructorContext(state, "00".repeat(32)),
    trust.method,
    trust.publicKey,
    trust.registryId,
    tree.root(),
    pureCircuits.administratorKey(admin),
    domain,
    audience,
    appB,
  );
  const context = createCircuitContext(
    sampleContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState,
    initial.currentPrivateState,
    undefined,
    undefined,
    now,
  );
  const authorize = (
    ctx = context,
    app = audience,
    policy = 1n,
    nonce = challenge.challenge,
    lower = BigInt(now),
    deadline = challenge.expiresAt,
  ) =>
    contract.impureCircuits.authorize(ctx, app, policy, nonce, lower, deadline);
  return {
    issuer,
    holder,
    id,
    q,
    contract,
    context,
    authorize,
    appB,
    challenge,
    domain,
  };
}
test("V3 signed contract checks signatures, hidden status path and consumes one request", () => {
  const f = fixture();
  const result = f.authorize();
  assert.equal(
    ledger(result.context.currentQueryContext.state).consumed.size(),
    1n,
  );
  assert.throws(() => f.authorize(result.context), /consumed/);
  const a = [...ledger(result.context.currentQueryContext.state).consumed][0];
  assert.notDeepEqual(a, f.q.credential.statusBinding.statusHandleCommitment);
});
test("V3 revocation root rejects an old valid witness and administrator is required", () => {
  const f = fixture();
  f.issuer.revoke(f.id);
  const tree = new ActiveStatusTree(f.issuer.statusEntries());
  const revoked = f.contract.impureCircuits.publishStatus(
    f.context,
    tree.root(),
  ).context;
  assert.throws(() => f.authorize(revoked), /not active/);
  f.context.currentPrivateState.admin = random32();
  assert.throws(
    () => f.contract.impureCircuits.publishStatus(f.context, tree.root()),
    /Unauthorized/,
  );
  assert.throws(
    () => f.contract.impureCircuits.deactivate(f.context),
    /Unauthorized/,
  );
});
test("V3 rejects tampered signatures, membership paths, policies and validity windows", () => {
  {
    const f = fixture();
    f.context.currentPrivateState.witness.qualification.claims.level = 3n;
    assert.throws(() => f.authorize());
  }
  {
    const f = fixture();
    f.context.currentPrivateState.path.siblings[0] = random32();
    assert.throws(() => f.authorize(), /not active/);
  }
  {
    const f = fixture();
    assert.throws(() => f.authorize(f.context, f.appB, 2n), /context/);
  }
  {
    const f = fixture();
    assert.throws(
      () =>
        f.authorize(
          f.context,
          undefined,
          undefined,
          undefined,
          BigInt(now + 1),
        ),
      /not yet valid/,
    );
  }
  {
    const f = fixture();
    assert.throws(
      () =>
        f.authorize(
          f.context,
          undefined,
          undefined,
          undefined,
          BigInt(now - 1),
        ),
      /in future/,
    );
  }
  {
    const f = fixture();
    const stopped = f.contract.impureCircuits.deactivate(f.context).context;
    assert.throws(() => f.authorize(stopped), /inactive/);
  }
});
test("V3 status tree keeps other credentials active when one is revoked", () => {
  const f = fixture(),
    other = new Holder(() => now),
    q = f.issuer.issue(other.request(f.issuer.approve(1))),
    id = other.accept(q, f.issuer.publicTrust());
  const before = new ActiveStatusTree(f.issuer.statusEntries());
  f.issuer.revoke(f.id);
  const after = new ActiveStatusTree(f.issuer.statusEntries());
  assert.notDeepEqual(before.root(), after.root());
  let root = pureCircuits.statusLeaf(
    q.credential.statusBinding.statusHandleCommitment,
    pureCircuits.credentialRoot(q.credential),
  );
  const p = after.path(id);
  for (let i = 0; i < 16; i++)
    root = p.right[i]
      ? pureCircuits.statusNode(p.siblings[i], root)
      : pureCircuits.statusNode(root, p.siblings[i]);
  assert.deepEqual(root, after.root());
});
