// SPDX-License-Identifier: Apache-2.0
const LIMIT = 1024 * 1024;
export function encodeWire(value: unknown): string {
  // Wallet SDKs can install BigInt.prototype.toJSON. JSON invokes that hook
  // before a replacer, silently turning typed integers into ordinary strings.
  // Normalize native values first so transport never depends on global hooks.
  const seen = new WeakSet<object>();
  function normalize(v: unknown, depth = 0): unknown {
    if (depth > 64) throw new Error("Payload nesting too deep");
    if (typeof v === "bigint")
      return { $veilpass: "bigint", value: v.toString() };
    if (v instanceof Uint8Array)
      return {
        $veilpass: "bytes",
        value: Array.from(v, (n) => n.toString(16).padStart(2, "0")).join(""),
      };
    if (v && typeof v === "object") {
      if (seen.has(v)) throw new Error("Cyclic payload");
      seen.add(v);
      try {
        return Array.isArray(v)
          ? v.map((item) => normalize(item, depth + 1))
          : Object.fromEntries(
              Object.entries(v).map(([key, item]) => [
                key,
                normalize(item, depth + 1),
              ]),
            );
      } finally {
        seen.delete(v);
      }
    }
    return v;
  }
  const text = JSON.stringify(normalize(value));
  if (typeof text !== "string") throw new Error("Invalid wire value");
  if (text.length > LIMIT) throw new Error("Payload too large");
  return text;
}
export function decodeWire(text: string): unknown {
  if (typeof text !== "string" || text.length > LIMIT)
    throw new Error("Payload too large");
  return JSON.parse(text, (_key, v) => {
    if (v && typeof v === "object" && Object.hasOwn(v, "$veilpass")) {
      if (Object.keys(v).length !== 2 || typeof v.value !== "string")
        throw new Error("Malformed wire value");
      if (v.$veilpass === "bigint" && /^(0|[1-9][0-9]{0,77})$/.test(v.value))
        return BigInt(v.value);
      if (v.$veilpass === "bytes" && /^(?:[0-9a-f]{2}){1,1024}$/.test(v.value))
        return Uint8Array.from(v.value.match(/../g) || [], (n: string) =>
          parseInt(n, 16),
        );
      throw new Error("Malformed wire value");
    }
    return v;
  });
}
