// SPDX-License-Identifier: Apache-2.0
import { constants } from "node:fs";
import { mkdir, lstat, open, unlink } from "node:fs/promises";
import path from "node:path";
import { Holder } from "./index.js";
function ownerOnly(stat: { mode: number; uid: number }) {
  return (
    (stat.mode & 0o077) === 0 &&
    (typeof process.getuid !== "function" || stat.uid === process.getuid())
  );
}
export async function saveHolderBackup(
  file: string,
  holder: Holder,
  passphrase: string,
) {
  const directory = path.dirname(path.resolve(file));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const parent = await lstat(directory);
  if (!parent.isDirectory() || parent.isSymbolicLink() || !ownerOnly(parent))
    throw new Error("Backup directory must be owner-only");
  const encrypted = await holder.backup(passphrase);
  const handle = await open(
    file,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(encrypted, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlink(file);
    throw error;
  }
  await handle.close();
  const parentHandle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    await parentHandle.sync();
  } finally {
    await parentHandle.close();
  }
}
export async function loadHolderBackup(
  file: string,
  passphrase: string,
  clock?: () => number,
) {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !ownerOnly(stat) || stat.size > 1500000)
      throw new Error("Backup must be an owner-only bounded file");
    const bytes = Buffer.alloc(1500001);
    let size = 0;
    while (size < bytes.length) {
      const result = await handle.read(bytes, size, bytes.length - size, size);
      if (!result.bytesRead) break;
      size += result.bytesRead;
    }
    if (size > 1500000) throw new Error("Backup too large");
    return await Holder.restore(
      bytes.subarray(0, size).toString("utf8"),
      passphrase,
      clock,
    );
  } finally {
    await handle.close();
  }
}
