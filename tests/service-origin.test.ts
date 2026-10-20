import { expect, it } from "vitest";
import { serviceOriginAllowed } from "../apps/web/lib/service-origin";

it("preserves loopback access while requiring exact mutation origins", () => {
  const headers = new Headers({ host: "127.0.0.1:3018", origin: "http://127.0.0.1:3018" });
  expect(serviceOriginAllowed(headers, { mutation: true })).toBe(true);
  headers.set("origin", "https://attacker.example");
  expect(serviceOriginAllowed(headers, { mutation: true })).toBe(false);
  expect(serviceOriginAllowed(headers, { mutation: false })).toBe(true);
});

it("requires configured HTTPS authority and ignores forwarded host spoofing", () => {
  const headers = new Headers({ host: "api.veilpass.example", origin: "https://api.veilpass.example" });
  const options = { publicOrigin: "https://api.veilpass.example", mutation: true };
  expect(serviceOriginAllowed(headers, options)).toBe(true);
  headers.set("host", "attacker.example");
  headers.set("x-forwarded-host", "api.veilpass.example");
  expect(serviceOriginAllowed(headers, options)).toBe(false);
});

it("rejects invalid public configuration and cross-origin writes", () => {
  const headers = new Headers({ host: "api.veilpass.example" });
  for (const publicOrigin of ["bad", "http://api.veilpass.example", "https://user@api.veilpass.example", "https://api.veilpass.example/path", "https://api.veilpass.example?token=secret", "https://localhost"]) {
    expect(serviceOriginAllowed(headers, { publicOrigin, mutation: false })).toBe(false);
  }
  expect(serviceOriginAllowed(headers, { publicOrigin: "https://api.veilpass.example", mutation: true })).toBe(false);
  expect(serviceOriginAllowed(headers, { mutation: false })).toBe(false);
});
