// SPDX-License-Identifier: Apache-2.0
import {
  pureCircuits,
  type StatusPath,
} from "../managed-authorization/contract/index.js";
type Entry = { id: string; revoked: boolean; credentialRoot: Uint8Array };
/** Sparse 16-level tree. Revoked/unissued leaves are zero. Position is private. */
export class ActiveStatusTree {
  #nodes = new Map<string, Uint8Array>();
  #defaults: Uint8Array[] = [new Uint8Array(32)];
  #indices = new Map<string, number>();
  constructor(entries: Entry[]) {
    if (entries.length > 65536) throw new Error("Status tree full");
    for (let level = 0; level < 16; level++)
      this.#defaults.push(
        pureCircuits.statusNode(this.#defaults[level], this.#defaults[level]),
      );
    entries.forEach((entry, index) => {
      if (
        !/^[0-9a-f]{64}$/.test(entry.id) ||
        this.#indices.has(entry.id) ||
        entry.credentialRoot.length !== 32
      )
        throw new Error("Invalid status entry");
      this.#indices.set(entry.id, index);
      if (entry.revoked) return;
      const handle = Uint8Array.from(entry.id.match(/../g)!, (n) =>
        parseInt(n, 16),
      );
      let node = pureCircuits.statusLeaf(handle, entry.credentialRoot),
        position = index;
      this.#nodes.set(`0:${position}`, node);
      for (let level = 0; level < 16; level++) {
        const sibling = this.#node(level, position ^ 1);
        node =
          position & 1
            ? pureCircuits.statusNode(sibling, node)
            : pureCircuits.statusNode(node, sibling);
        position = Math.floor(position / 2);
        this.#nodes.set(`${level + 1}:${position}`, node);
      }
    });
  }
  #node(level: number, index: number) {
    return this.#nodes.get(`${level}:${index}`) || this.#defaults[level];
  }
  root() {
    return Uint8Array.from(this.#node(16, 0));
  }
  path(id: string): StatusPath {
    let index = this.#indices.get(id);
    if (index === undefined) throw new Error("Unknown status handle");
    const siblings: Uint8Array[] = [],
      right: boolean[] = [];
    for (let level = 0; level < 16; level++) {
      siblings.push(Uint8Array.from(this.#node(level, index ^ 1)));
      right.push(Boolean(index & 1));
      index = Math.floor(index / 2);
    }
    return { siblings, right };
  }
}
