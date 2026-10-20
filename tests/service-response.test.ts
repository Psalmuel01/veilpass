import { afterEach, expect, it, vi } from "vitest";
import { serviceResponse } from "../apps/web/lib/service-response";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("retries a cold-start read and accepts JSON without exposing an HTML parser error", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValueOnce(new Response("loading", { headers: { "content-type": "text/html" } }))
    .mockResolvedValueOnce(new Response('{"ready":true}', { headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  const request = serviceResponse("/api/issuance");
  await vi.advanceTimersByTimeAsync(15000);
  expect(await (await request).json()).toEqual({ ready: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1].redirect).toBe("error");
});
it("never automatically repeats a potentially committed mutation", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("network lost after submit"));
  vi.stubGlobal("fetch", fetcher);
  await expect(serviceResponse("/api/issuance", { method: "POST", body: '{}' })).rejects.toThrow("Check its result before retrying");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("preserves a JSON authorization rejection and never sends credentials to arbitrary endpoints", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  expect((await serviceResponse("/api/issuance", { method: "POST" })).status).toBe(401);
  await expect(serviceResponse("https://attacker.invalid", { headers: { authorization: "Bearer test" } })).rejects.toThrow("Invalid service endpoint");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
