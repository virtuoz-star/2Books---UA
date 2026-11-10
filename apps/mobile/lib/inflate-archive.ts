import { Gunzip, Inflate } from "fflate";

import {
  twoBooksInflateLimits,
  type TwoBooksInflate,
} from "../../../src/library/two-books-parse";

export const ENTRY_INFLATE_CAP = twoBooksInflateLimits.maxEntryBytes;
export const ARCHIVE_INFLATE_CAP = twoBooksInflateLimits.maxTotalBytes;

export function beginArchiveInflate(): void {}

export function endArchiveInflate(): void {}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function findEocd(bytes: Uint8Array): number | null {
  const min = Math.max(0, bytes.length - (22 + 65_535));
  for (let index = bytes.length - 22; index >= min; index -= 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x05 &&
      bytes[index + 3] === 0x06 &&
      readU16(bytes, index + 20) === bytes.length - (index + 22)
    ) {
      return index;
    }
  }
  return null;
}

function findZipStart(bytes: Uint8Array): number {
  const last = Math.min(bytes.length - 4, 64);
  for (let index = 0; index <= last; index += 1) {
    if (
      bytes[index] === 0x50 &&
      bytes[index + 1] === 0x4b &&
      bytes[index + 2] === 0x03 &&
      bytes[index + 3] === 0x04
    ) {
      return index;
    }
  }
  return 0;
}

/** False when a zip central directory declares an inflated size past the cap. Unknown zips pass. */
export function archiveDeclaredSizeAllowed(bytes: Uint8Array): boolean {
  const eocd = findEocd(bytes);
  if (eocd === null || eocd + 22 > bytes.length) return true;
  const count = readU16(bytes, eocd + 8) === 0xffff ? 0xffff : readU16(bytes, eocd + 10);
  const totalEntries = readU16(bytes, eocd + 10);
  const size = readU32(bytes, eocd + 12);
  const offset = readU32(bytes, eocd + 16);
  if (count === 0xffff || totalEntries === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    return false;
  }
  const start = findZipStart(bytes) + offset;
  if (start < 0 || start + size > bytes.length || start > eocd) return true;
  let cursor = start;
  let total = 0;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > start + size) return true;
    if (readU32(bytes, cursor) !== 0x02014b50) return true;
    const uncompressed = readU32(bytes, cursor + 24);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    if (uncompressed === 0xffffffff || uncompressed > ENTRY_INFLATE_CAP) return false;
    total += uncompressed;
    if (total > ARCHIVE_INFLATE_CAP) return false;
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return true;
}

export function inflatedWithinCaps(used: number, next: number): boolean {
  return next <= ENTRY_INFLATE_CAP && used + next <= ARCHIVE_INFLATE_CAP;
}

export function gzipDeclaredSize(bytes: Uint8Array): number | null {
  if (bytes.length < 8 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null;
  return readU32(bytes, bytes.length - 4);
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function callCap(maxBytes: number): number {
  return Math.min(maxBytes, ENTRY_INFLATE_CAP);
}

async function inflateCapped(
  bytes: Uint8Array,
  format: "deflate-raw" | "gzip",
  maxBytes: number,
): Promise<Uint8Array> {
  const cap = callCap(maxBytes);
  if (!Number.isFinite(cap) || cap < 0) throw new Error("inflate cap");
  if (format === "gzip") {
    const declared = gzipDeclaredSize(bytes);
    if (declared !== null && declared > cap) throw new Error("inflate cap");
  }
  const copy =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes
      : Uint8Array.from(bytes);
  const chunks: Uint8Array[] = [];
  let total = 0;
  let failed: Error | null = null;
  const stream = format === "gzip" ? new Gunzip() : new Inflate();
  stream.ondata = (data) => {
    if (failed) return;
    total += data.byteLength;
    if (total > cap) {
      chunks.length = 0;
      failed = new Error("inflate cap");
      throw failed;
    }
    if (data.byteLength > 0) chunks.push(data.slice());
  };
  const step = 256;
  try {
    if (copy.length === 0) stream.push(new Uint8Array(), true);
    for (let offset = 0; offset < copy.length; offset += step) {
      if (failed) break;
      const end = Math.min(copy.length, offset + step);
      stream.push(copy.subarray(offset, end), end === copy.length);
    }
  } catch (error) {
    if (failed) throw failed;
    throw error;
  }
  if (failed) throw failed;
  await yieldToPaint();
  return concatChunks(chunks, total);
}

export const inflateArchive: TwoBooksInflate = (bytes, format, maxBytes) =>
  inflateCapped(bytes, format, maxBytes);
