/** Same-origin issuer transport. Never retry a mutation automatically. */
export async function serviceResponse(path: string, options: RequestInit = {}): Promise<Response> {
  if (!/^\/api\/(issuance|signed-network|readiness)(\?|$)/.test(path)) throw new Error("Invalid service endpoint");
  const read = !options.method || options.method.toUpperCase() === "GET";
  const attempts = read ? 5 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (options.signal?.aborted) throw new Error("Request cancelled.");
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, read ? 15000 : 65000);
    try {
      const response = await fetch(path, { ...options, credentials: "same-origin", redirect: "error", signal: controller.signal });
      const json = response.headers.get("content-type")?.includes("application/json");
      if (json && ![502, 504].includes(response.status)) return response;
      await response.body?.cancel();
    } catch {
      if (options.signal?.aborted) throw new Error("Request cancelled.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
    }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error(read
    ? "The service is waking up or temporarily unavailable. Wait a moment and retry. Your vault remains on this device."
    : "The service did not confirm this operation. Check its result before retrying. For enrollment, reuse the same offer and holder wallet.");
}
