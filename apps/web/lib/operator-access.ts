import { timingSafeEqual } from "node:crypto";
import { operatorAllowed, type Operator } from "../../../integrations/issuance/src/operators";
export async function authenticateOperator(headers: Pick<Headers, "get">): Promise<Operator | null> {
  const authorization = headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length > 1100) return null;
  const token = authorization.slice(7);
  // Existing operator secret remains an explicit recovery path during migration.
  const recovery = process.env.VEILPASS_ISSUER_ADMIN_TOKEN;
  if (process.env.VEILPASS_RECOVERY_ADMIN_DISABLED !== "1" && recovery) {
    const a = Buffer.from(token), b = Buffer.from(recovery);
    if (a.length === b.length && timingSafeEqual(a, b)) return { id: "recovery-operator", role: "administrator" };
  }
  if (process.env.VEILPASS_STORAGE !== "postgres") return null;
  const { hostedDatabase } = await import("../../../integrations/issuance/src/postgres");
  return hostedDatabase().authenticateOperator(token);
}
export { operatorAllowed };
