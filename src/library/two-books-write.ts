import type { Book } from "#/content/catalog";
import type { NativeLanguage } from "#/i18n/types";

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxChapters = 200;
const maxSentences = 20_000;
const maxSentenceLength = 8_000;
const maxTitleLength = 200;
const maxChapterJson = 800_000;

type ExportSentence = {
  en: string;
  translation: string;
  paragraph: number;
};

type ExportChapter = {
  title: string;
  sentences: ExportSentence[];
};

export function downloadSlug(bookId: string): string | null {
  const slug = bookId === "gift-of-the-magi" ? "gift-of-the-magi-reader" : bookId.trim();
  if (slug.length < 1 || slug.length > 80 || !idPattern.test(slug)) return null;
  return slug;
}

function clip(value: string): string {
  return value.trim().slice(0, maxTitleLength).trim();
}

function chaptersFor(book: Book, slot: NativeLanguage): ExportChapter[] | null {
  const chapters: ExportChapter[] = [];
  let sentenceCount = 0;
  for (const chapter of book.chapters) {
    let current: ExportSentence[] = [];
    let running = 2;
    const title = clip(chapter.title.en) || clip(book.title.en);
    const flush = () => {
      if (current.length === 0) return;
      chapters.push({ title, sentences: current });
      current = [];
      running = 2;
    };
    for (const sentence of chapter.sentences) {
      const en = sentence.en.trim();
      const translation = sentence[slot].trim();
      if (en === "" || translation === "") continue;
      if (en.length > maxSentenceLength || translation.length > maxSentenceLength) return null;
      const next = { en, translation, paragraph: sentence.paragraph ?? 0 };
      const size = JSON.stringify(next).length + 1;
      if (current.length > 0 && running + size > maxChapterJson) flush();
      current.push(next);
      running += size;
      sentenceCount += 1;
      if (sentenceCount > maxSentences) return null;
    }
    flush();
  }
  if (chapters.length < 1 || chapters.length > maxChapters) return null;
  return chapters;
}

function pageFor(sentences: ExportSentence[]) {
  return {
    version: 2,
    tokens1: sentences.map((sentence, index) => {
      const next = sentences[index + 1];
      const paragraphBreak = next !== undefined && next.paragraph !== sentence.paragraph;
      return [sentence.en, "", paragraphBreak ? "\n" : "", index, null];
    }),
    tokens2: sentences.map((sentence) => [sentence.translation, "", ""]),
    sentences: sentences.map((_, index) => index),
    footnotes1: [],
    footnotes2: [],
  };
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

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  crcTable[index] = crc >>> 0;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    const byte = data[index] ?? 0;
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function blobFrom(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy]);
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = blobFrom(data).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipJson(value: unknown): Promise<Uint8Array> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  const stream = blobFrom(json).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function zip(
  entries: { name: string; data: Uint8Array; stored?: boolean }[],
): Promise<Uint8Array> {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  let centralSize = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const method = entry.stored === true ? 0 : 8;
    const compressed = method === 0 ? entry.data : await deflate(entry.data);
    const checksum = crc32(entry.data);
    const local = concat([
      Uint8Array.from([
        0x50,
        0x4b,
        0x03,
        0x04,
        ...u16(20),
        ...u16(0),
        ...u16(method),
        ...u16(0),
        ...u16(0),
        ...u32(checksum),
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
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(checksum),
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

/** Prefer `slot`. If that language has no sentences, use the other native language. */
export async function writeTwoBooksPrefer(
  book: Book,
  slot: NativeLanguage,
): Promise<Uint8Array | null> {
  const preferred = await writeTwoBooks(book, slot);
  if (preferred !== null) return preferred;
  return writeTwoBooks(book, slot === "uk" ? "ru" : "uk");
}

/** A `.2books` archive of one native language. Null when that language has no sentences. */
export async function writeTwoBooks(book: Book, slot: NativeLanguage): Promise<Uint8Array | null> {
  const slug = downloadSlug(book.id);
  const author = clip(book.author);
  const englishTitle = clip(book.title.en);
  const translatedTitle = clip(book.title[slot]) || englishTitle;
  if (slug === null || author === "" || englishTitle === "" || translatedTitle === "") return null;
  const chapters = chaptersFor(book, slot);
  if (chapters === null) return null;
  const pages = await Promise.all(chapters.map((chapter) => gzipJson(pageFor(chapter.sentences))));
  const meta = {
    slug,
    main: { lang: "en", title: englishTitle, author, description: "" },
    secondary: { lang: slot, title: translatedTitle, author, description: "" },
  };
  const toc = {
    chapters: chapters.map((chapter, index) => ({ title: chapter.title, page: index })),
    pages: pages.map((_, index) => ({ path: `pages/${index}.json.gz`, length: 1 })),
  };
  const entries = [
    { name: "meta.json", data: new TextEncoder().encode(JSON.stringify(meta)) },
    { name: "toc.json", data: new TextEncoder().encode(JSON.stringify(toc)) },
    ...pages.map((data, index) => ({ name: `pages/${index}.json.gz`, data, stored: true })),
  ];
  return zip(entries);
}
