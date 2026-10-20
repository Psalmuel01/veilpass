import { afterEach, expect, it, vi } from "vitest";
import { hostedServiceConfigured, serviceRequestAllowed } from "../apps/web/lib/service-access";
afterEach(() => vi.unstubAllEnvs());
it("fails closed for missing storage, Vercel and insecure public origins", () => {
  const env = { VEILPASS_HOSTED_BACKEND: "1", VEILPASS_PUBLIC_ORIGIN: "https://backend.example", VEILPASS_DATA_DIRECTORY: "/var/data/veilpass" };
  expect(hostedServiceConfigured(env)).toBe(true);
  expect(hostedServiceConfigured({ ...env, VERCEL: "1" })).toBe(false);
  expect(hostedServiceConfigured({ ...env, VEILPASS_DATA_DIRECTORY: "relative" })).toBe(false);
  expect(hostedServiceConfigured({ ...env, VEILPASS_PUBLIC_ORIGIN: "http://backend.example" })).toBe(false);
  expect(hostedServiceConfigured({ ...env, VEILPASS_PUBLIC_ORIGIN: "https://backend.example?secret=x" })).toBe(false);
});
it("requires exact hosted origin and host without falling back to loopback", () => {
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VEILPASS_HOSTED_BACKEND", "1");
  vi.stubEnv("VEILPASS_PUBLIC_ORIGIN", "https://backend.example");
  vi.stubEnv("VEILPASS_DATA_DIRECTORY", "/var/data/veilpass");
  const headers = new Headers({ host: "backend.example", origin: "https://backend.example" });
  expect(serviceRequestAllowed(headers, true)).toBe(true);
  headers.set("origin", "https://attacker.example");
  expect(serviceRequestAllowed(headers, true)).toBe(false);
  headers.set("host", "localhost:3018");
  headers.set("origin", "http://localhost:3018");
  expect(serviceRequestAllowed(headers, true)).toBe(false);
  vi.stubEnv("VEILPASS_PUBLIC_ORIGIN", "");
  expect(serviceRequestAllowed(headers, false)).toBe(false);
});
it("supports ephemeral hosts only with an explicitly configured external database", () => {
  const env = { VEILPASS_HOSTED_BACKEND: "1", VEILPASS_PUBLIC_ORIGIN: "https://backend.example", VEILPASS_STORAGE: "postgres" };
  expect(hostedServiceConfigured(env)).toBe(false);
  expect(hostedServiceConfigured({ ...env, DATABASE_URL: "postgres://user:password@db.example/veilpass" })).toBe(true);
});
it("admits only the pinned frontend origin through a proxy and still requires the backend host", () => {
  vi.stubEnv("VERCEL", ""); vi.stubEnv("VEILPASS_HOSTED_BACKEND", "1");
  vi.stubEnv("VEILPASS_PUBLIC_ORIGIN", "https://backend.example");
  vi.stubEnv("VEILPASS_DATA_DIRECTORY", "/var/data/veilpass");
  vi.stubEnv("VEILPASS_FRONTEND_ORIGIN", "https://frontend.example");
  const headers = new Headers({ host: "backend.example", origin: "https://frontend.example" });
  expect(serviceRequestAllowed(headers, true)).toBe(true);
  headers.set("origin", "https://frontend.example.attacker.example");
  expect(serviceRequestAllowed(headers, true)).toBe(false);
  headers.set("origin", "https://frontend.example"); headers.set("host", "attacker.example");
  headers.set("x-forwarded-host", "backend.example");
  expect(serviceRequestAllowed(headers, true)).toBe(false);
  vi.stubEnv("VEILPASS_FRONTEND_ORIGIN", "https://frontend.example/path");
  expect(hostedServiceConfigured()).toBe(false);
});
