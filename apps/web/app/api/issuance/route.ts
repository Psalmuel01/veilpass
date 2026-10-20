import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { signedProjectRoot } from "../../../lib/signed-network-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const attempts = new Map<string, { count: number; until: number }>();
function configured() {
  return (
    process.env.VEILPASS_SIGNED_ISSUANCE === "1" &&
    !process.env.VERCEL &&
    (process.env.VEILPASS_ISSUER_STORAGE_KEY?.length || 0) >= 32 &&
    (process.env.VEILPASS_ISSUER_ADMIN_TOKEN?.length || 0) >= 32
  );
}
function local(request: NextRequest) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(
    request.headers.get("host") || "",
  );
}
function admin(request: NextRequest) {
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(
    `Bearer ${process.env.VEILPASS_ISSUER_ADMIN_TOKEN || ""}`,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function modules() {
  const [model, service] = await Promise.all([
    import("../../../../../integrations/issuance/src/index"),
    import("../../../../../integrations/issuance/src/service"),
  ]);
  const directory =
    process.env.VEILPASS_ISSUER_DIRECTORY ||
    path.join(signedProjectRoot(), ".private/signed-issuer");
  return {
    ...model,
    withIssuer: <T>(action: Parameters<typeof service.withIssuer<T>>[2]) =>
      service.withIssuer(
        directory,
        process.env.VEILPASS_ISSUER_STORAGE_KEY!,
        action,
      ),
  };
}
export async function GET(request: NextRequest) {
  if (!configured() || !local(request))
    return NextResponse.json(
      {
        error:
          "Signed issuance is not configured. Run the local issuer service.",
      },
      { status: 503, headers },
    );
  try {
    const m = await modules();
    const id = request.nextUrl.searchParams.get("id");
    if (id && !/^[0-9a-f]{64}$/.test(id))
      return NextResponse.json(
        { error: "Invalid credential reference" },
        { status: 400, headers },
      );
    let result: unknown;
    if (id && request.nextUrl.searchParams.get("path") === "1") {
      const { ActiveStatusTree } = await import(
        "../../../../../integrations/issuance/src/status-tree"
      );
      result = await m.withIssuer((issuer) => {
        const tree = new ActiveStatusTree(issuer.statusEntries());
        return { root: tree.root(), path: tree.path(id) };
      });
    } else
      result = await m.withIssuer((issuer) =>
        id ? (issuer.statusReader().read(id) ?? null) : issuer.publicTrust(),
      );
    return new NextResponse(m.encodeWire(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Issuer storage unavailable. Check local service configuration.",
      },
      { status: 503, headers },
    );
  }
}
async function boundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 65536) {
        await reader.cancel();
        throw new Error("Request too large");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export async function POST(request: NextRequest) {
  if (!configured() || !local(request))
    return NextResponse.json(
      {
        error:
          "Signed issuance is not configured. Run the local issuer service.",
      },
      { status: 503, headers },
    );
  if (request.headers.get("origin") !== `http://${request.headers.get("host")}`)
    return NextResponse.json(
      { error: "Origin rejected" },
      { status: 403, headers },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json(
      { error: "JSON required" },
      { status: 415, headers },
    );
  const now = Date.now();
  for (const [id, rate] of attempts) if (rate.until < now) attempts.delete(id);
  const rate = attempts.get("local") || { count: 0, until: now + 60000 };
  attempts.set("local", rate);
  if (++rate.count > 60)
    return NextResponse.json(
      { error: "Too many requests. Retry in one minute." },
      { status: 429, headers },
    );
  try {
    // Authenticate administration before importing cryptographic runtime or reading state.
    const text = await boundedBody(request);
    const action = JSON.parse(text)?.action;
    if (!["approve", "issue", "revoke", "deactivate"].includes(action))
      throw new Error("Unknown action");
    if (action !== "issue" && !admin(request))
      return NextResponse.json(
        { error: "Issuer authentication required" },
        { status: 401, headers },
      );
    const m = await modules();
    const body = m.decodeWire(text) as {
      action: string;
      level: 1 | 2;
      holder: Parameters<InstanceType<typeof m.IssuerAuthority>["approve"]>[1];
      request: Parameters<InstanceType<typeof m.IssuerAuthority>["issue"]>[0];
      id: string;
    };
    const result = await m.withIssuer((issuer) => {
      if (action === "approve") {
        if (
          !body.holder?.method ||
          !body.holder.publicKey ||
          typeof body.holder.publicKey.x !== "bigint" ||
          typeof body.holder.publicKey.y !== "bigint"
        )
          throw new Error("Holder enrollment identity required");
        return issuer.approve(body.level, body.holder);
      }
      if (action === "issue") return issuer.issueOrResume(body.request);
      if (action === "revoke") {
        if (!/^[0-9a-f]{64}$/.test(body.id))
          throw new Error("Invalid credential reference");
        issuer.revoke(body.id);
      }
      if (action === "deactivate") issuer.deactivate();
      return { ok: true };
    });
    return new NextResponse(m.encodeWire(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Issuance request rejected. Check approval, holder identity, expiry and service configuration.",
      },
      { status: 400, headers },
    );
  }
}
