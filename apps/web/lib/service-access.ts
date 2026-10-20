import path from "node:path";
import { serviceOriginAllowed } from "./service-origin";

export function hostedServiceConfigured(env = process.env) {
  if (env.VERCEL || env.VEILPASS_HOSTED_BACKEND !== "1") return false;
  if (!env.VEILPASS_PUBLIC_ORIGIN) return false;
  if (env.VEILPASS_STORAGE === "postgres") {
    if (!env.DATABASE_URL) return false;
  } else if (!env.VEILPASS_DATA_DIRECTORY || !path.isAbsolute(env.VEILPASS_DATA_DIRECTORY)) return false;
  try {
    const url = new URL(env.VEILPASS_PUBLIC_ORIGIN);
    if (env.VEILPASS_FRONTEND_ORIGIN) {
      const frontend = new URL(env.VEILPASS_FRONTEND_ORIGIN);
      if (!serviceOriginAllowed(new Headers({ host: frontend.host }), {
        publicOrigin: env.VEILPASS_FRONTEND_ORIGIN, mutation: false,
      })) return false;
    }
    return serviceOriginAllowed(new Headers({ host: url.host }), {
      publicOrigin: env.VEILPASS_PUBLIC_ORIGIN, mutation: false,
    });
  } catch { return false; }
}
export function serviceRequestAllowed(headers: Pick<Headers, "get">, mutation: boolean) {
  if (process.env.VEILPASS_HOSTED_BACKEND === "1") {
    if (!hostedServiceConfigured() || !serviceOriginAllowed(headers, {
      publicOrigin: process.env.VEILPASS_PUBLIC_ORIGIN, mutation: false,
    })) return false;
    if (!mutation) return true;
    const origin = headers.get("origin");
    return origin === new URL(process.env.VEILPASS_PUBLIC_ORIGIN!).origin ||
      (!!process.env.VEILPASS_FRONTEND_ORIGIN && origin === new URL(process.env.VEILPASS_FRONTEND_ORIGIN).origin);
  }
  return serviceOriginAllowed(headers, { mutation });
}
export async function admitServiceRequest(bucket: "issuer" | "verifier" | "readiness") {
  if (process.env.VEILPASS_HOSTED_BACKEND !== "1") return true;
  if (!hostedServiceConfigured()) return false;
  if (process.env.VEILPASS_STORAGE === "postgres") {
    const { hostedDatabase } = await import("../../../integrations/issuance/src/postgres");
    return hostedDatabase().take(bucket, 60, 60);
  }
  const { RequestStore } = await import("../../../integrations/issuance/src/request-store");
  const store = new RequestStore(path.join(process.env.VEILPASS_DATA_DIRECTORY!, "limits"));
  try { return store.take(bucket, 60, 60000); } finally { store.close(); }
}
