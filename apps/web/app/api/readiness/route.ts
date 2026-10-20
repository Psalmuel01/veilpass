import { NextRequest, NextResponse } from "next/server";
import { hostedServiceConfigured, serviceRequestAllowed, admitServiceRequest } from "../../../lib/service-access";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  // Readiness is distinct from liveness and never implies chain acceptance.
  if (!hostedServiceConfigured() || !serviceRequestAllowed(request.headers, false))
    return NextResponse.json({ status: "unavailable", issuer: false, productionReady: false }, { status: 503, headers });
  try {
    if (!(await admitServiceRequest("readiness")))
      return NextResponse.json({ status: "rate-limited", productionReady: false }, { status: 429, headers });
    const { hostedDatabase } = await import("../../../../../integrations/issuance/src/postgres");
    const { rows } = await hostedDatabase().pool.query("SELECT fingerprint FROM veilpass_authority WHERE id=1");
    const issuer = rows.length === 1 && !!process.env.VEILPASS_ISSUER_FINGERPRINT &&
      rows[0].fingerprint === process.env.VEILPASS_ISSUER_FINGERPRINT &&
      process.env.VEILPASS_SIGNED_ISSUANCE === "1" &&
      (process.env.VEILPASS_ISSUER_STORAGE_KEY?.length || 0) >= 32 &&
      (process.env.VEILPASS_ISSUER_ADMIN_TOKEN?.length || 0) >= 32;
    return NextResponse.json({ status: issuer ? "issuer-ready" : "unavailable", issuer,
      database: true, networkConfigured: process.env.VEILPASS_SIGNED_NETWORK === "1",
      productionReady: false, acceptance: "Preprod contract, installed wallet and external review require separate evidence" },
      { status: issuer ? 200 : 503, headers });
  } catch {
    return NextResponse.json({ status: "unavailable", issuer: false, productionReady: false }, { status: 503, headers });
  }
}
