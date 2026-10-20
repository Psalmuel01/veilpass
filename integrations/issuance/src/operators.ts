// Server-only operator authentication. Tokens are random credentials, never passwords.
import { createHash, randomBytes } from "node:crypto";
export type OperatorRole = "issuer" | "revoker" | "administrator";
export type Operator = { id: string; role: OperatorRole };
export function operatorId(id: string) {
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(id)) throw new Error("Operator ID must be 3–64 lowercase letters, digits or hyphens");
  return id;
}
export function operatorRole(role: string): OperatorRole {
  if (!["issuer", "revoker", "administrator"].includes(role)) throw new Error("Invalid operator role");
  return role as OperatorRole;
}
export function operatorToken() { return `vp_op_${randomBytes(32).toString("hex")}`; }
export function operatorDigest(token: string) {
  if (!/^vp_op_[0-9a-f]{64}$/.test(token)) throw new Error("Invalid operator credential");
  return createHash("sha256").update(`veilpass:operator:v1:${token}`).digest("hex");
}
export function operatorAllowed(role: OperatorRole, action: string) {
  return (role === "administrator" && ["approve", "revoke", "deactivate"].includes(action)) || (role === "issuer" && action === "approve") ||
    (role === "revoker" && action === "revoke");
}
