import { expect, test } from "vite-plus/test";

import { parseTwoBooks } from "#/library/two-books";

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

async function compress(data: Uint8Array, method: 0 | 8): Promise<Uint8Array> {
  if (method === 0) return data;
  const stream = blobFrom(data).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipJson(value: unknown): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const stream = blobFrom(json).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function buildArchive(
  entries: { name: string; data: Uint8Array }[],
  options: { prefix?: Uint8Array; method?: 0 | 8 } = {},
): Promise<Uint8Array> {
  const method = options.method ?? 8;
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const compressed = await compress(entry.data, method);
    const local = concat([
      Uint8Array.from([
        0x50,
        0x4b,
        0x03,
        0x04,
        ...u16(20),
        ...u16(0x08),
        ...u16(method),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(0),
        ...u32(0),
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
      ...u16(method),
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
  return concat([options.prefix ?? new Uint8Array(), ...locals, ...central, eocd]);
}

function meta(slot: "RU" | "UK", slug: string) {
  return {
    slug,
    main: { lang: "EN", mlLang: "en", title: "Red Boat", author: "A. Writer", description: "" },
    secondary: {
      lang: slot,
      mlLang: slot.toLowerCase(),
      title: slot === "RU" ? "Красная лодка" : "Синя брама",
      author: "А. Автор",
      description: "",
    },
  };
}

test("reads a prefixed deflate archive into chapters and paragraphs", async () => {
  const page0 = {
    version: 2,
    tokens1: [
      ["Hello", "", " ", 0, 100],
      ["there", "", ".\n", 1, 100],
      ["Next", ",", " ", 3, 100],
      ["line", "", ".", 5, 100],
    ],
    tokens2: [
      ["Привет", "", " "],
      ["там", "", ". "],
      ["Лишнее", "", " "],
      ["Дальше", "", " "],
      ["слово", "", " "],
      ["строка", "", "."],
    ],
    sentences: [0, 2],
    footnotes1: [],
    footnotes2: [],
  };
  const page1 = {
    version: 2,
    tokens1: [
      ["Left", "", " ", 0, 100],
      ["side", "", ".", 2, 100],
      ["Right", "", " ", 2, 100],
      ["edge", "", ".", 3, 100],
      ["Also", "", ".", 3, 100],
    ],
    tokens2: [
      ["левая", "", " "],
      ["дыра", "", " "],
      ["общая", "", ". "],
      ["край", "", "."],
    ],
    sentences: [0, 2, 4],
    footnotes1: [],
    footnotes2: [],
  };
  const toc = {
    chapters: [
      { title: "Part", page: 0 },
      { title: "One", page: 0 },
      { title: "Two", page: 1 },
    ],
    pages: [
      { path: "pages/0.json.gz", length: 2 },
      { path: "pages/1.json.gz", length: 2 },
    ],
  };
  const bytes = await buildArchive(
    [
      { name: "cover.jpg", data: Uint8Array.from([1, 2, 3]) },
      { name: "ml.done", data: new TextEncoder().encode("1") },
      { name: "meta.json", data: new TextEncoder().encode(JSON.stringify(meta("RU", "red-boat"))) },
      { name: "toc.json", data: new TextEncoder().encode(JSON.stringify(toc)) },
      { name: "pages/0.json.gz", data: await gzipJson(page0) },
      { name: "pages/1.json.gz", data: await gzipJson(page1) },
    ],
    {
      prefix: Uint8Array.from([
        0x78, 0x32, 0x62, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]),
      method: 8,
    },
  );

  const parsed = await parseTwoBooks(bytes);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.book.id).toBe("red-boat");
  expect(parsed.book.author).toBe("A. Writer");
  expect(parsed.book.title).toEqual({ en: "Red Boat", uk: "Red Boat", ru: "Красная лодка" });
  expect(parsed.book.chapters.map((chapter) => chapter.id)).toEqual(["c1", "c2"]);
  expect(parsed.book.chapters.map((chapter) => chapter.title.en)).toEqual(["Part — One", "Two"]);
  expect(parsed.book.chapters.flatMap((chapter) => chapter.sentences)).toEqual([
    { id: "s1", en: "Hello there.", uk: "", ru: "Привет там.", paragraph: 0 },
    { id: "s2", en: "Next, line.", uk: "", ru: "Лишнее Дальше слово строка.", paragraph: 1 },
    { id: "s3", en: "Left side.", uk: "", ru: "левая дыра общая.", paragraph: 0 },
    { id: "s4", en: "Right edge.", uk: "", ru: "край.", paragraph: 0 },
    { id: "s5", en: "Also.", uk: "", ru: "край.", paragraph: 0 },
  ]);
});

test("stores a Ukrainian translation in the Ukrainian field", async () => {
  const page = {
    version: 2,
    tokens1: [["Gate", "", ".", 0, null]],
    tokens2: [["Брама", "", "."]],
    sentences: [0],
    footnotes1: [],
    footnotes2: [],
  };
  const bytes = await buildArchive(
    [
      {
        name: "meta.json",
        data: new TextEncoder().encode(JSON.stringify(meta("UK", "blue-gate"))),
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
    ],
    { method: 0 },
  );
  const parsed = await parseTwoBooks(bytes);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.book.title.ru).toBe("Red Boat");
  expect(parsed.book.chapters[0]?.sentences[0]).toEqual({
    id: "s1",
    en: "Gate.",
    uk: "Брама.",
    ru: "",
    paragraph: 0,
  });
});

test("rejects a reserved id and a file that is not an archive", async () => {
  const page = {
    version: 2,
    tokens1: [["No", "", ".", 0, 0]],
    tokens2: [["Нет", "", "."]],
    sentences: [0],
    footnotes1: [],
    footnotes2: [],
  };
  const reserved = await buildArchive(
    [
      {
        name: "meta.json",
        data: new TextEncoder().encode(JSON.stringify(meta("RU", "gift-of-the-magi"))),
      },
      {
        name: "toc.json",
        data: new TextEncoder().encode(
          JSON.stringify({
            chapters: [{ title: "One", page: 0 }],
            pages: [{ path: "pages/0.json.gz", length: 1 }],
          }),
        ),
      },
      { name: "pages/0.json.gz", data: await gzipJson(page) },
    ],
    { method: 0 },
  );
  expect(await parseTwoBooks(reserved)).toEqual({ ok: false, error: "reserved-id" });
  expect(await parseTwoBooks(new TextEncoder().encode("hello"))).toEqual({
    ok: false,
    error: "invalid-input",
  });
});
