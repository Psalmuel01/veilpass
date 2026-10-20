import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  // Liveness only: this must never be interpreted as contract/service readiness.
  return NextResponse.json({ status: "ok", check: "liveness" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
