import { parseTwoBooksArchive } from "./two-books-parse";

async function inflateWeb(
  bytes: Uint8Array,
  format: "deflate-raw" | "gzip",
  maxBytes: number,
): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      const value = step.value;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("inflate cap");
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function parseTwoBooks(bytes: Uint8Array) {
  return parseTwoBooksArchive(bytes, inflateWeb);
}

export type {
  TwoBooksCatalog,
  TwoBooksSentence,
  TwoBooksInflate,
  ParseTwoBooksOptions,
} from "./two-books-parse";
export { twoBooksInflateLimits } from "./two-books-parse";
export { parseTwoBooksArchive } from "./two-books-parse";
