// SPDX-License-Identifier: Apache-2.0
const LIMIT = 1024 * 1024;
export function encodeWire(value: unknown): string {
  const text = JSON.stringify(value, (_key, v) =>
    typeof v === "bigint"
      ? { $veilpass: "bigint", value: v.toString() }
      : v instanceof Uint8Array
        ? { $veilpass: "bytes", value: Buffer.from(v).toString("hex") }
        : v,
  );
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
        return new Uint8Array(Buffer.from(v.value, "hex"));
      throw new Error("Malformed wire value");
    }
    return v;
  });
}
