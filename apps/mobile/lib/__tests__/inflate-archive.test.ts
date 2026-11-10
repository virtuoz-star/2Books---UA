import { deflateSync } from "fflate";
import { expect, test } from "bun:test";

import { parseTwoBooksArchive } from "../../../../src/library/two-books-parse";
import {
  ARCHIVE_INFLATE_CAP,
  ENTRY_INFLATE_CAP,
  archiveDeclaredSizeAllowed,
  gzipDeclaredSize,
  inflateArchive,
  inflatedWithinCaps,
} from "../inflate-archive";

async function inflateWeb(bytes: Uint8Array, format: "deflate-raw" | "gzip"): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function blobFrom(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy]);
}

async function compress(data: Uint8Array): Promise<Uint8Array> {
  const stream = blobFrom(data).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipJson(value: unknown): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const stream = blobFrom(json).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function buildArchive(entries: { name: string; data: Uint8Array }[]): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const compressed = await compress(entry.data);
    const local = concat([
      Uint8Array.from([
        0x50,
        0x4b,
        0x03,
        0x04,
        ...u16(20),
        ...u16(0x08),
        ...u16(8),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(compressed.length),
        ...u32(entry.data.length),
        ...u16(name.length),
        ...u16(0),
      ]),
      name,
      compressed,
    ]);
    locals.push(local);
    const header = Uint8Array.from([
      0x50,
      0x4b,
      0x01,
      0x02,
      ...u16(20),
      ...u16(20),
      ...u16(0x08),
      ...u16(8),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(compressed.length),
      ...u32(entry.data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ]);
    central.push(header, name);
    centralSize += header.length + name.length;
    offset += local.length;
  }
  const eocd = Uint8Array.from([
    0x50,
    0x4b,
    0x05,
    0x06,
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);
  return concat([...locals, ...central, eocd]);
}

test("inflation stops at the entry cap and the archive cap", async () => {
  expect(inflatedWithinCaps(0, ENTRY_INFLATE_CAP)).toBe(true);
  expect(inflatedWithinCaps(0, ENTRY_INFLATE_CAP + 1)).toBe(false);
  expect(inflatedWithinCaps(ARCHIVE_INFLATE_CAP - 1, 2)).toBe(false);
  const raw = new Uint8Array(ENTRY_INFLATE_CAP + 1);
  let deflateMessage = "";
  try {
    await inflateArchive(deflateSync(raw), "deflate-raw", ENTRY_INFLATE_CAP);
  } catch (error) {
    deflateMessage = error instanceof Error ? error.message : "";
  }
  expect(deflateMessage).toBe("inflate cap");
  const gzip = new Uint8Array(18);
  gzip[0] = 0x1f;
  gzip[1] = 0x8b;
  gzip[14] = (ENTRY_INFLATE_CAP + 1) & 0xff;
  gzip[15] = ((ENTRY_INFLATE_CAP + 1) >> 8) & 0xff;
  gzip[16] = ((ENTRY_INFLATE_CAP + 1) >> 16) & 0xff;
  gzip[17] = ((ENTRY_INFLATE_CAP + 1) >> 24) & 0xff;
  expect(gzipDeclaredSize(gzip)).toBe(ENTRY_INFLATE_CAP + 1);
  let gzipMessage = "";
  try {
    await inflateArchive(gzip, "gzip", ENTRY_INFLATE_CAP);
  } catch (error) {
    gzipMessage = error instanceof Error ? error.message : "";
  }
  expect(gzipMessage).toBe("inflate cap");
});

test("a zip that declares an inflated entry past the cap is refused", async () => {
  const name = new TextEncoder().encode("meta.json");
  const payload = new Uint8Array([1]);
  const local = concat([
    Uint8Array.from([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(payload.length),
      ...u32(payload.length),
      ...u16(name.length),
      ...u16(0),
    ]),
    name,
    payload,
  ]);
  const central = concat([
    Uint8Array.from([
      0x50,
      0x4b,
      0x01,
      0x02,
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(payload.length),
      ...u32(ENTRY_INFLATE_CAP + 1),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(0),
    ]),
    name,
  ]);
  const eocd = Uint8Array.from([
    0x50,
    0x4b,
    0x05,
    0x06,
    ...u16(0),
    ...u16(0),
    ...u16(1),
    ...u16(1),
    ...u32(central.length),
    ...u32(local.length),
    ...u16(0),
  ]);
  const bytes = concat([local, central, eocd]);
  expect(archiveDeclaredSizeAllowed(bytes)).toBe(false);
  const allowed = await buildArchive([
    { name: "meta.json", data: new TextEncoder().encode('{"slug":"red-boat"}') },
  ]);
  expect(archiveDeclaredSizeAllowed(allowed)).toBe(true);
});

test("fflate and DecompressionStream read the same synthetic archive", async () => {
  const page = {
    version: 2,
    tokens1: [["Gate", "", ".", 0, null]],
    tokens2: [["Брама", "", "."]],
    sentences: [0],
    footnotes1: [],
    footnotes2: [],
  };
  const bytes = await buildArchive([
    {
      name: "meta.json",
      data: new TextEncoder().encode(
        JSON.stringify({
          slug: "red-boat",
          main: {
            lang: "EN",
            mlLang: "en",
            title: "Red Boat",
            author: "A. Writer",
            description: "",
          },
          secondary: {
            lang: "UK",
            mlLang: "uk",
            title: "Червоний",
            author: "А. Автор",
            description: "",
          },
        }),
      ),
    },
    {
      name: "toc.json",
      data: new TextEncoder().encode(
        JSON.stringify({
          chapters: [{ title: "Gate", page: 0 }],
          pages: [{ path: "pages/0.json.gz", length: 1 }],
        }),
      ),
    },
    { name: "pages/0.json.gz", data: await gzipJson(page) },
  ]);
  const web = await parseTwoBooksArchive(bytes, inflateWeb);
  const phone = await parseTwoBooksArchive(bytes, inflateArchive);
  expect(phone).toEqual(web);
  expect(phone.ok).toBe(true);
});
