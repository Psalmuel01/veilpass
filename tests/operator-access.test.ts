import { afterEach, describe, expect, it, vi } from "vitest";
import { operatorAllowed, operatorDigest, operatorId, operatorRole, operatorToken } from "../integrations/issuance/src/operators";
import { authenticateOperator } from "../apps/web/lib/operator-access";
afterEach(() => vi.unstubAllEnvs());
describe("operator security", () => {
  it("restricts role capabilities", () => {
    expect(operatorAllowed("issuer", "approve")).toBe(true);
    expect(operatorAllowed("issuer", "revoke")).toBe(false);
    expect(operatorAllowed("revoker", "approve")).toBe(false);
    expect(operatorAllowed("revoker", "deactivate")).toBe(false);
    expect(operatorAllowed("revoker", "revoke")).toBe(true);
    expect(operatorAllowed("administrator", "deactivate")).toBe(true);
    expect(operatorAllowed("administrator", "unknown")).toBe(false);
    expect(() => operatorRole("superuser")).toThrow();
    expect(() => operatorId("../admin")).toThrow();
  });
  it("uses independent random credentials and rejects password-shaped tokens", () => {
    const a = operatorToken(), b = operatorToken();
    expect(a).not.toBe(b);
    expect(operatorDigest(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(operatorDigest(a)).not.toBe(operatorDigest(b));
    expect(() => operatorDigest("password")).toThrow();
  });
  it("allows explicitly configured recovery access and supports disabling it", async () => {
    vi.stubEnv("VEILPASS_STORAGE", "sqlite");
    vi.stubEnv("VEILPASS_ISSUER_ADMIN_TOKEN", "recovery-credential-".repeat(3));
    const valid = new Headers({ authorization: `Bearer ${process.env.VEILPASS_ISSUER_ADMIN_TOKEN}` });
    expect(await authenticateOperator(valid)).toEqual({ id: "recovery-operator", role: "administrator" });
    expect(await authenticateOperator(new Headers({ authorization: "Bearer incorrect" }))).toBeNull();
    vi.stubEnv("VEILPASS_RECOVERY_ADMIN_DISABLED", "1");
    expect(await authenticateOperator(valid)).toBeNull();
  });
});
