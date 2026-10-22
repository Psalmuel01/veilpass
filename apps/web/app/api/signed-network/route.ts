import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { serviceRequestAllowed, admitServiceRequest } from "../../../lib/service-access";
import path from "node:path";
import {
  signedNetworkConfig,
  signedOperatorIndexer,
  signedProjectRoot,
} from "../../../lib/signed-network-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const local = (r: NextRequest) =>
  serviceRequestAllowed(r.headers, false);
export async function GET(request: NextRequest) {
  if (!local(request))
    return NextResponse.json(
      { error: "Local network configuration required" },
      { status: 503, headers },
    );
  try {
    if (!(await admitServiceRequest("verifier")))
      return NextResponse.json({ error: "Request limit reached" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    const c = await signedNetworkConfig();
    const { encodeWire } = await import(
      "../../../../../integrations/issuance/src/wire"
    );
    return new NextResponse(encodeWire(c), { headers });
  } catch (error) {
    if (process.env.VEILPASS_TEST_DIAGNOSTICS === "1") console.error("V3 network request:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error:
          "V3 network is not configured. Local signature checks remain available.",
      },
      { status: 503, headers },
    );
  }
}
export async function POST(request: NextRequest) {
  if (
    !local(request) ||
    !serviceRequestAllowed(request.headers, true)
  )
    return NextResponse.json(
      { error: "Origin rejected" },
      { status: 403, headers },
    );
  let config;
  try {
    if (!(await admitServiceRequest("verifier")))
      return NextResponse.json({ error: "Request limit reached" }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    config = await signedNetworkConfig();
  } catch {
    return NextResponse.json(
      { error: "V3 network is not configured" },
      { status: 503, headers },
    );
  }
  try {
    if (
      request.headers.get("content-type") !== "application/json" ||
      Number(request.headers.get("content-length") || 0) > 4096
    )
      throw new Error("Invalid request");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing request");
    let text = "",
      length = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > 4096) {
          await reader.cancel();
          throw new Error("Request too large");
        }
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    const body = JSON.parse(text);
    if (body.policy !== 1 && body.policy !== 2)
      throw new Error("Invalid policy");
    const [
      { SignedMidnightAdapter },
      { createSignedVerifier },
      { SqliteChallengeStore },
    ] = await Promise.all([
      import("../../../../../integrations/issuance/src/midnight-adapter"),
      import("../../../../../integrations/issuance/src/verifier"),
      import("../../../../../integrations/issuance/src/challenge-store"),
    ]);
    const assets = path.join(
      signedProjectRoot(),
      "integrations/issuance/managed-authorization/keys",
    );
    const verifierKeys = {
      authorize: await readFile(path.join(assets, "authorize.verifier")),
      publishStatus: await readFile(
        path.join(assets, "publishStatus.verifier"),
      ),
      deactivate: await readFile(path.join(assets, "deactivate.verifier")),
    };
    const chain = new SignedMidnightAdapter({
      indexerUrl: signedOperatorIndexer(config),
      contractAddress: config.contractAddress,
      networkDomain: config.domain,
      trust: config.trust,
      verifierKeys,
    });
    const store = process.env.VEILPASS_STORAGE === "postgres"
      ? (await import("../../../../../integrations/issuance/src/postgres")).hostedDatabase()
          .challengeStore(`${config.contractAddress}:${body.policy}`)
      : new SqliteChallengeStore(
      path.resolve(
        process.env.VEILPASS_VERIFIER_DIRECTORY ||
          path.join(signedProjectRoot(), ".private/signed-verifiers"),
        config.contractAddress,
        String(body.policy),
      ),
    );
    try {
      const verifier = createSignedVerifier({
        audience: body.policy === 1 ? config.appA : config.appB,
        domain: config.domain,
        contractAddress: config.contractAddress,
        policy: body.policy,
        chain,
        store,
      });
      const result =
        body.action === "challenge"
          ? await verifier.createChallenge(300)
          : body.action === "verify"
            ? await verifier.verify(body.presentation)
            : (() => {
                throw new Error("Unknown action");
              })();
      return NextResponse.json(result, { headers });
    } finally {
      store.close();
    }
  } catch (error) {
    if (process.env.VEILPASS_TEST_DIAGNOSTICS === "1") console.error("V3 network request:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      {
        error:
          "V3 request rejected. Check network state, context, expiry, status and replay.",
      },
      { status: 400, headers },
    );
  }
}
