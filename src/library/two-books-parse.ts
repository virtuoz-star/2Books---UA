const reservedCatalogId = "gift-of-the-magi";
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pagePathPattern = /^pages\/(\d+)\.json\.gz$/;

const importLimits = {
  maxArchiveBytes: 25_000_000,
  maxChapters: 200,
  maxSentences: 20_000,
  maxSentenceLength: 8_000,
  maxTitleLength: 200,
  maxIdLength: 80,
  maxChapterJson: 900_000,
  maxPrefixBytes: 64,
  maxEntryBytes: 8_000_000,
  maxInflatedBytes: 60_000_000,
  maxPages: 2_000,
  maxPageSentences: 5_000,
  maxPageTokens: 200_000,
} as const;

/** Per-entry and per-archive inflate caps. The phone inflater must use the same numbers. */
export const twoBooksInflateLimits = {
  maxEntryBytes: importLimits.maxEntryBytes,
  maxTotalBytes: importLimits.maxInflatedBytes,
} as const;

export type TwoBooksSentence = {
  id: string;
  en: string;
  uk: string;
  ru: string;
  paragraph: number;
};

export type TwoBooksCatalog = {
  id: string;
  author: string;
  title: { uk: string; ru: string; en: string };
  chapters: {
    id: string;
    title: { uk: string; ru: string; en: string };
    sentences: TwoBooksSentence[];
  }[];
};

export type TwoBooksInflate = (
  bytes: Uint8Array,
  format: "deflate-raw" | "gzip",
  maxBytes: number,
) => Promise<Uint8Array>;

export type ParseTwoBooksOptions = {
  /** Default false. The web and admin callers leave this off. */
  allowEmptyAuthor?: boolean;
};

type ZipEntry = {
  name: string;
  method: number;
  compSize: number;
  localOffset: number;
};

type PageSentence = {
  en: string;
  translation: string;
  paragraphBreak: boolean;
};

type InflateBudget = { total: number };

const openingMarks = new Set(["“", '"', "«", "(", "[", "—", "–"]);

function invalid(): { ok: false; error: "invalid-input" } {
  return { ok: false, error: "invalid-input" };
}

function reserved(): { ok: false; error: "reserved-id" } {
  return { ok: false, error: "reserved-id" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim();
}

function normalize(value: string): string {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(/\s+/g, " ").trim();
}

function isEnglish(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lang = value.trim().toLowerCase();
  return lang === "en" || lang === "eng" || lang === "english";
}

function nativeSlot(value: unknown): "uk" | "ru" | null {
  if (typeof value !== "string") return null;
  const lang = value.trim().toLowerCase();
  if (lang === "uk" || lang === "ua" || lang === "ukr" || lang === "ukrainian") return "uk";
  if (lang === "ru" || lang === "rus" || lang === "russian") return "ru";
  return null;
}

function findZipStart(bytes: Uint8Array): number | null {
  const last = Math.min(bytes.length - 4, importLimits.maxPrefixBytes);
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
  return null;
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

function readCentralDirectory(bytes: Uint8Array, zipStart: number): ZipEntry[] | null {
  const eocd = findEocd(bytes);
  if (eocd === null) return null;
  const count = readU16(bytes, eocd + 10);
  const size = readU32(bytes, eocd + 12);
  const offset = readU32(bytes, eocd + 16);
  if (offset === 0xffffffff || size === 0xffffffff) return null;
  // Offsets in the central directory are relative to the zip, after any prefix.
  const start = zipStart + offset;
  if (start < zipStart || start + size > bytes.length || start > eocd) return null;
  const entries: ZipEntry[] = [];
  let cursor = start;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > start + size) return null;
    if (readU32(bytes, cursor) !== 0x02014b50) return null;
    const flags = readU16(bytes, cursor + 8);
    const method = readU16(bytes, cursor + 10);
    const compSize = readU32(bytes, cursor + 20);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const localOffset = readU32(bytes, cursor + 42);
    if ((flags & 1) !== 0 || compSize === 0xffffffff || localOffset === 0xffffffff) return null;
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength + commentLength > start + size) return null;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd)).replaceAll("\\", "/");
    entries.push({ name: name.replace(/^\//, ""), method, compSize, localOffset });
    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function entryCap(budget: InflateBudget, countTowardTotal: boolean): number | null {
  if (!countTowardTotal) return importLimits.maxEntryBytes;
  const remaining = importLimits.maxInflatedBytes - budget.total;
  if (remaining <= 0) return null;
  return Math.min(importLimits.maxEntryBytes, remaining);
}

async function inflateCapped(
  bytes: Uint8Array,
  format: "deflate-raw" | "gzip",
  inflate: TwoBooksInflate,
  budget: InflateBudget,
  countTowardTotal: boolean,
): Promise<Uint8Array | null> {
  const maxBytes = entryCap(budget, countTowardTotal);
  if (maxBytes === null || bytes.byteLength > importLimits.maxEntryBytes) return null;
  try {
    const out = await inflate(bytes, format, maxBytes);
    if (out.byteLength > maxBytes) return null;
    if (countTowardTotal) budget.total += out.byteLength;
    return out;
  } catch {
    return null;
  }
}

async function readEntry(
  bytes: Uint8Array,
  zipStart: number,
  entry: ZipEntry,
  inflate: TwoBooksInflate,
  budget: InflateBudget,
): Promise<Uint8Array | null> {
  if (entry.method !== 0 && entry.method !== 8) return null;
  const local = zipStart + entry.localOffset;
  if (local < zipStart || local + 30 > bytes.length) return null;
  if (readU32(bytes, local) !== 0x04034b50) return null;
  const nameLength = readU16(bytes, local + 26);
  const extraLength = readU16(bytes, local + 28);
  const dataStart = local + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compSize;
  if (dataStart < local || dataEnd > bytes.length) return null;
  const compressed = bytes.subarray(dataStart, dataEnd);
  if (compressed.byteLength > importLimits.maxEntryBytes) return null;
  if (entry.method === 0) {
    const stored = new Uint8Array(compressed.byteLength);
    stored.set(compressed);
    return stored;
  }
  return inflateCapped(compressed, "deflate-raw", inflate, budget, false);
}

async function readJson(
  bytes: Uint8Array,
  gzip: boolean,
  inflate: TwoBooksInflate,
  budget: InflateBudget,
): Promise<unknown> {
  try {
    let decoded = bytes;
    if (gzip) {
      const text = await inflateCapped(bytes, "gzip", inflate, budget, true);
      if (text === null) return null;
      decoded = text;
    } else if (bytes.byteLength > importLimits.maxEntryBytes) {
      return null;
    } else {
      const room = entryCap(budget, true);
      if (room === null || bytes.byteLength > room) return null;
      budget.total += bytes.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(decoded));
  } catch {
    return null;
  }
}

function wanted(name: string): boolean {
  return name === "meta.json" || name === "toc.json" || pagePathPattern.test(name);
}

async function readNamed(
  file: Uint8Array,
  zipStart: number,
  entries: Map<string, ZipEntry>,
  name: string,
  inflate: TwoBooksInflate,
  budget: InflateBudget,
): Promise<unknown> {
  const entry = entries.get(name);
  if (!entry) return null;
  const raw = await readEntry(file, zipStart, entry, inflate, budget);
  if (raw === null) return null;
  return readJson(raw, name.endsWith(".gz"), inflate, budget);
}

async function readArchive(
  file: Uint8Array,
  inflate: TwoBooksInflate,
): Promise<Map<string, unknown> | null> {
  const zipStart = findZipStart(file);
  if (zipStart === null) return null;
  const listed = readCentralDirectory(file, zipStart);
  if (listed === null) return null;
  const entries = new Map<string, ZipEntry>();
  for (const entry of listed) {
    if (!wanted(entry.name) || entries.has(entry.name)) continue;
    entries.set(entry.name, entry);
  }
  const budget: InflateBudget = { total: 0 };
  const files = new Map<string, unknown>();
  const meta = await readNamed(file, zipStart, entries, "meta.json", inflate, budget);
  const toc = await readNamed(file, zipStart, entries, "toc.json", inflate, budget);
  if (meta === null || toc === null) return null;
  if (!isRecord(toc) || !Array.isArray(toc.pages) || toc.pages.length > importLimits.maxPages) {
    return null;
  }
  files.set("meta.json", meta);
  files.set("toc.json", toc);
  for (let index = 0; index < toc.pages.length; index += 1) {
    const page = toc.pages[index];
    const name = `pages/${index}.json.gz`;
    if (!isRecord(page) || page.path !== name) return null;
    const parsed = await readNamed(file, zipStart, entries, name, inflate, budget);
    if (parsed === null) return null;
    files.set(name, parsed);
  }
  return files;
}

function tokenSurface(token: unknown[]): string {
  const text = typeof token[0] === "string" ? token[0] : "";
  const extra = typeof token[1] === "string" ? token[1] : "";
  const suffix = typeof token[2] === "string" ? token[2] : "";
  const attached = extra !== "" && !text.endsWith(extra) && !suffix.includes(extra) ? extra : "";
  if (openingMarks.has(attached)) return attached + text + suffix;
  return text + attached + suffix;
}

function asTokens(value: unknown, minLength: number): unknown[][] | null {
  if (!Array.isArray(value)) return null;
  const tokens: unknown[][] = [];
  for (const token of value) {
    if (!Array.isArray(token) || token.length < minLength) return null;
    tokens.push(token);
  }
  return tokens;
}

function alignOf(token: unknown[]): number | null {
  const value = token[3];
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

// A token inside one aligned span belongs to that sentence.
// A token between spans belongs to the following sentence.
// A token claimed by two sentences stays with the earlier sentence.
function translationIndexes(sentenceAligns: number[][], tokenCount: number): number[][] {
  const firstOwner = new Map<number, number>();
  for (let sentenceIndex = 0; sentenceIndex < sentenceAligns.length; sentenceIndex += 1) {
    for (const align of sentenceAligns[sentenceIndex] ?? []) {
      if (align < 0 || align >= tokenCount || firstOwner.has(align)) continue;
      firstOwner.set(align, sentenceIndex);
    }
  }
  const ranges: ({ start: number; end: number } | null)[] = sentenceAligns.map((aligns) => {
    const usable = aligns.filter((align) => align >= 0 && align < tokenCount);
    if (usable.length === 0) return null;
    return { start: Math.min(...usable), end: Math.max(...usable) };
  });
  const assigned = new Map<number, number>(firstOwner);
  for (let index = 0; index < tokenCount; index += 1) {
    if (assigned.has(index)) continue;
    const holders: number[] = [];
    for (let sentenceIndex = 0; sentenceIndex < ranges.length; sentenceIndex += 1) {
      const range = ranges[sentenceIndex];
      if (range && index >= range.start && index <= range.end) holders.push(sentenceIndex);
    }
    if (holders.length === 1) assigned.set(index, holders[0] ?? 0);
  }
  for (let index = 0; index < tokenCount; index += 1) {
    if (assigned.has(index)) continue;
    let previous: number | null = null;
    let previousEnd = -1;
    let next: number | null = null;
    let nextStart = tokenCount;
    for (let sentenceIndex = 0; sentenceIndex < ranges.length; sentenceIndex += 1) {
      const range = ranges[sentenceIndex];
      if (!range) continue;
      if (range.end < index && range.end > previousEnd) {
        previous = sentenceIndex;
        previousEnd = range.end;
      }
      if (range.start > index && range.start < nextStart) {
        next = sentenceIndex;
        nextStart = range.start;
      }
    }
    if (next !== null) assigned.set(index, next);
    else if (previous !== null) assigned.set(index, previous);
  }
  const indexes = sentenceAligns.map(() => [] as number[]);
  for (const [index, sentenceIndex] of assigned) indexes[sentenceIndex]?.push(index);
  for (const list of indexes) list.sort((left, right) => left - right);
  return indexes;
}

function parsePage(value: unknown): PageSentence[] | null {
  if (!isRecord(value)) return null;
  const english = asTokens(value.tokens1, 4);
  const translated = asTokens(value.tokens2, 3);
  if (english === null || translated === null || !Array.isArray(value.sentences)) return null;
  if (value.sentences.length > importLimits.maxPageSentences) return null;
  if (
    english.length > importLimits.maxPageTokens ||
    translated.length > importLimits.maxPageTokens
  ) {
    return null;
  }
  if (value.sentences.length === 0) return [];
  const spans: unknown[][][] = [];
  const aligns: number[][] = [];
  for (let index = 0; index < value.sentences.length; index += 1) {
    const start = value.sentences[index];
    const end = index + 1 < value.sentences.length ? value.sentences[index + 1] : english.length;
    if (typeof start !== "number" || !Number.isInteger(start)) return null;
    if (typeof end !== "number" || !Number.isInteger(end)) return null;
    if (start < 0 || end <= start || end > english.length) return null;
    const span = english.slice(start, end);
    const spanAligns: number[] = [];
    for (const token of span) {
      const align = alignOf(token);
      if (align === null) return null;
      spanAligns.push(align);
    }
    spans.push(span);
    aligns.push(spanAligns);
  }
  const translatedIndexes = translationIndexes(aligns, translated.length);
  return spans.map((span, index) => {
    const last = span[span.length - 1];
    let tokenIndexes = translatedIndexes[index] ?? [];
    if (tokenIndexes.length === 0) {
      tokenIndexes = [...new Set(aligns[index] ?? [])]
        .filter((align) => align >= 0 && align < translated.length)
        .sort((left, right) => left - right);
    }
    const translation = tokenIndexes
      .map((tokenIndex) => tokenSurface(translated[tokenIndex] ?? []))
      .join("");
    return {
      en: normalize(span.map((token) => tokenSurface(token)).join("")),
      translation: normalize(translation),
      paragraphBreak: typeof last?.[2] === "string" && last[2].includes("\n"),
    };
  });
}

function localizedTitle(english: string, translated: string, slot: "uk" | "ru") {
  return {
    en: english,
    uk: slot === "uk" ? translated : english,
    ru: slot === "ru" ? translated : english,
  };
}

function buildBook(
  files: Map<string, unknown>,
  options: ParseTwoBooksOptions,
): { ok: true; book: TwoBooksCatalog } | { ok: false; error: "invalid-input" | "reserved-id" } {
  const meta = files.get("meta.json");
  const toc = files.get("toc.json");
  if (!isRecord(meta) || !isRecord(toc)) return invalid();
  const main = isRecord(meta.main) ? meta.main : null;
  const secondary = isRecord(meta.secondary) ? meta.secondary : null;
  if (main === null || secondary === null) return invalid();
  if (!isEnglish(main.lang) && !isEnglish(main.mlLang)) return invalid();
  const slot = nativeSlot(secondary.lang) ?? nativeSlot(secondary.mlLang);
  if (slot === null) return invalid();
  if (typeof meta.slug !== "string") return invalid();
  const id = meta.slug.trim();
  if (id === reservedCatalogId) return reserved();
  if (id.length > importLimits.maxIdLength || !idPattern.test(id)) return invalid();
  const author = clip(
    typeof main.author === "string" && main.author.trim() !== ""
      ? main.author
      : typeof secondary.author === "string"
        ? secondary.author
        : "",
    importLimits.maxTitleLength,
  );
  const englishTitle = clip(
    typeof main.title === "string" ? main.title : "",
    importLimits.maxTitleLength,
  );
  const translatedTitle = clip(
    typeof secondary.title === "string" && secondary.title.trim() !== ""
      ? secondary.title
      : englishTitle,
    importLimits.maxTitleLength,
  );
  if (englishTitle === "" || translatedTitle === "") return invalid();
  if (author === "" && options.allowEmptyAuthor !== true) return invalid();
  if (!Array.isArray(toc.chapters) || !Array.isArray(toc.pages) || toc.pages.length < 1)
    return invalid();

  const pages: unknown[] = [];
  for (let index = 0; index < toc.pages.length; index += 1) {
    const entry = toc.pages[index];
    if (!isRecord(entry) || entry.path !== `pages/${index}.json.gz`) return invalid();
    const page = files.get(`pages/${index}.json.gz`);
    if (page === undefined) return invalid();
    pages.push(page);
  }

  const markers: { title: string; page: number }[] = [];
  for (const chapter of toc.chapters) {
    if (!isRecord(chapter) || typeof chapter.page !== "number" || !Number.isInteger(chapter.page)) {
      return invalid();
    }
    if (chapter.page < 0 || chapter.page > pages.length) return invalid();
    const previous = markers[markers.length - 1];
    if (previous && chapter.page < previous.page) return invalid();
    markers.push({
      title: clip(
        typeof chapter.title === "string" ? chapter.title : "",
        importLimits.maxTitleLength,
      ),
      page: chapter.page,
    });
  }

  if (markers.length > importLimits.maxChapters) return invalid();
  const groups: { parts: string[]; start: number; end: number; split: boolean }[] = [];
  if (markers.length === 0) {
    groups.push({ parts: [], start: 0, end: pages.length, split: true });
  } else {
    const first = markers[0];
    if (first && first.page > 0) {
      groups.push({ parts: [], start: 0, end: first.page, split: false });
    }
    let pending: string[] = [];
    for (let index = 0; index < markers.length; index += 1) {
      const marker = markers[index];
      if (!marker) return invalid();
      const end =
        index + 1 < markers.length ? (markers[index + 1]?.page ?? pages.length) : pages.length;
      if (marker.title !== "") pending.push(marker.title);
      if (end <= marker.page) continue;
      groups.push({ parts: pending, start: marker.page, end, split: false });
      pending = [];
    }
    const last = groups[groups.length - 1];
    if (pending.length > 0 && last) last.parts = [...last.parts, ...pending];
  }
  if (groups.length < 1) return invalid();

  let sentenceNumber = 0;
  const chapters: TwoBooksCatalog["chapters"] = [];
  const splitBudget = importLimits.maxChapterJson - 1024;
  const pushChapter = (titleText: string, sentences: TwoBooksSentence[]): boolean => {
    if (sentences.length === 0) return true;
    const clipped = clip(titleText, importLimits.maxTitleLength) || englishTitle;
    const title = localizedTitle(clipped, clipped, slot);
    const chapter = { id: `c${chapters.length + 1}`, title, sentences };
    if (JSON.stringify(chapter).length > importLimits.maxChapterJson) return false;
    if (chapters.length >= importLimits.maxChapters) return false;
    chapters.push(chapter);
    return true;
  };
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    if (!group) return invalid();
    const sentences: TwoBooksSentence[] = [];
    let paragraph = 0;
    for (let pageIndex = group.start; pageIndex < group.end; pageIndex += 1) {
      const parsed = parsePage(pages[pageIndex]);
      if (parsed === null) return invalid();
      for (const sentence of parsed) {
        if (sentence.en !== "") {
          if (sentence.en.length > importLimits.maxSentenceLength) return invalid();
          if (sentence.translation.length > importLimits.maxSentenceLength) return invalid();
          sentenceNumber += 1;
          if (sentenceNumber > importLimits.maxSentences) return invalid();
          sentences.push({
            id: `s${sentenceNumber}`,
            en: sentence.en,
            uk: slot === "uk" ? sentence.translation : "",
            ru: slot === "ru" ? sentence.translation : "",
            paragraph,
          });
        }
        if (sentence.paragraphBreak) paragraph += 1;
      }
    }
    const titleText = group.parts.join(" — ");
    if (!group.split) {
      if (!pushChapter(titleText, sentences)) return invalid();
      continue;
    }
    let current: TwoBooksSentence[] = [];
    let running = 2;
    const flush = (): boolean => {
      const chunk = current;
      current = [];
      running = 2;
      return pushChapter(titleText, chunk);
    };
    for (const sentence of sentences) {
      const size = JSON.stringify(sentence).length + 1;
      if (current.length > 0 && running + size > splitBudget) {
        if (!flush()) return invalid();
      }
      current.push(sentence);
      running += size;
    }
    if (!flush()) return invalid();
  }
  if (chapters.length < 1) return invalid();
  return {
    ok: true,
    book: {
      id,
      author,
      title: localizedTitle(englishTitle, translatedTitle, slot),
      chapters,
    },
  };
}

export async function parseTwoBooksArchive(
  bytes: Uint8Array,
  inflate: TwoBooksInflate,
  options: ParseTwoBooksOptions = {},
): Promise<
  { ok: true; book: TwoBooksCatalog } | { ok: false; error: "invalid-input" | "reserved-id" }
> {
  if (bytes.byteLength < 1 || bytes.byteLength > importLimits.maxArchiveBytes) return invalid();
  try {
    const files = await readArchive(bytes, inflate);
    if (files === null) return invalid();
    return buildBook(files, options);
  } catch {
    return invalid();
  }
}
