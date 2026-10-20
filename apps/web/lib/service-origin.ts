// Explicit origin policy for a future persistent hosted service. Never infer
// public authority from forwarded headers supplied by a caller.
export function serviceOriginAllowed(
  headers: Pick<Headers, "get">,
  options: { publicOrigin?: string; mutation: boolean },
): boolean {
  const host = headers.get("host") || "";
  let expected: string;
  if (options.publicOrigin) {
    let url: URL;
    try { url = new URL(options.publicOrigin); } catch { return false; }
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash ||
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
    expected = url.origin;
    if (host !== url.host) return false;
  } else {
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return false;
    expected = `http://${host}`;
  }
  return !options.mutation || headers.get("origin") === expected;
}
