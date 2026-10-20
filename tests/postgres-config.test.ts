import { expect, it } from "vitest";
import { postgresConfig } from "../integrations/issuance/src/postgres";
it("forces certificate validation regardless of connection-string TLS overrides", () => {
  const c = postgresConfig("postgresql://user:password@db.example/veilpass?sslmode=disable&sslrootcert=/tmp/attacker");
  expect(c.ssl).toEqual({ rejectUnauthorized: true });
  expect(c).not.toHaveProperty("connectionString");
  expect(c.host).toBe("db.example");
  expect(c.max).toBe(3);
});
it("requires explicit loopback testing and rejects malformed database URLs", () => {
  expect(() => postgresConfig("postgres://user:pass@127.0.0.1/veilpass")).toThrow("explicit");
  expect(postgresConfig("postgres://user:pass@127.0.0.1/veilpass", true).ssl).toBe(false);
  for (const url of ["invalid", "http://user:pass@db.example/veilpass", "postgres://db.example/veilpass", "postgres://user:pass@db.example/", "postgres://user:pass@db.example/veilpass#secret"])
    expect(() => postgresConfig(url)).toThrow("configuration");
});
