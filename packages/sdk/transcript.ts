// SPDX-License-Identifier: Apache-2.0
import { valueToBigInt } from "@midnight-ntwrk/compact-runtime";
import type {
  Op,
  AlignedValue,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
/** Recognize the pinned Compact 0.31.1 consumed-set insertion, never a byte substring. */
export function requestFromTranscript(
  program: Op<AlignedValue>[],
  consumedField = 11n,
): string | null {
  const found: string[] = [];
  for (let i = 0; i + 4 < program.length; i++) {
    const [index, key, value, insert, parent] = program.slice(i, i + 5);
    if (
      typeof index !== "object" ||
      !("idx" in index) ||
      !index.idx.pushPath ||
      index.idx.path.length !== 1
    )
      continue;
    const field = index.idx.path[0];
    if (
      field.tag !== "value" ||
      valueToBigInt(field.value.value) !== consumedField
    )
      continue;
    if (
      typeof key !== "object" ||
      !("push" in key) ||
      key.push.storage ||
      key.push.value.tag !== "cell"
    )
      continue;
    const cell = key.push.value.content;
    if (
      cell.value.length !== 1 ||
      cell.value[0].length > 32 ||
      cell.alignment.length !== 1
    )
      continue;
    const alignment = cell.alignment[0];
    if (
      alignment.tag !== "atom" ||
      alignment.value.tag !== "bytes" ||
      alignment.value.length !== 32
    )
      continue;
    if (
      typeof value !== "object" ||
      !("push" in value) ||
      !value.push.storage ||
      value.push.value.tag !== "null"
    )
      continue;
    if (
      typeof insert !== "object" ||
      !("ins" in insert) ||
      insert.ins.cached ||
      insert.ins.n !== 1
    )
      continue;
    if (
      typeof parent !== "object" ||
      !("ins" in parent) ||
      !parent.ins.cached ||
      parent.ins.n !== 1
    )
      continue;
    const padded = new Uint8Array(32);
    padded.set(cell.value[0]);
    found.push(
      Array.from(padded, (n) => n.toString(16).padStart(2, "0")).join(""),
    );
  }
  return found.length === 1 ? found[0] : null;
}
