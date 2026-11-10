import {
  bookSummary,
  catalogBooks,
  getCatalogBook,
  translationLanguages,
  type Book,
  type BookSummary,
  type TranslationCode,
} from "#/content/catalog";
import { database } from "#/auth/db.server";
import type { PreparedCatalogBook } from "#/library/catalog-draft";
import { chapterView } from "#/library/chapter-view";
import type { TwoBooksCatalog } from "#/library/two-books";

type StoredSentence = { id: string; en: string; uk: string; ru: string; paragraph?: number };

export type StoredCatalogRecord = {
  book: Book;
  sentenceTotal: number;
  languages: TranslationCode[];
  incomplete?: boolean;
};

type ChapterMeta = {
  id: string;
  author: string;
  title: Record<"uk" | "ru" | "en", string>;
  chapterCount: number;
  sentenceCount: number;
};
type StoredChapter = {
  id: string;
  title: Record<"uk" | "ru" | "en", string>;
  sentences: StoredSentence[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localeTitle(value: unknown): Record<"uk" | "ru" | "en", string> | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.uk !== "string" ||
    typeof value.ru !== "string" ||
    typeof value.en !== "string"
  ) {
    return null;
  }
  return { uk: value.uk, ru: value.ru, en: value.en };
}

function parseStoredBook(body: string, id: string): Book | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const title = localeTitle(parsed.title);
  if (title === null || !Array.isArray(parsed.chapters)) return null;
  const chapters: StoredChapter[] = [];
  for (const chapter of parsed.chapters) {
    if (!isRecord(chapter) || typeof chapter.id !== "string") return null;
    const chapterTitle = localeTitle(chapter.title);
    if (chapterTitle === null || !Array.isArray(chapter.sentences)) return null;
    const sentences: StoredSentence[] = [];
    for (const sentence of chapter.sentences) {
      if (!isRecord(sentence)) return null;
      if (
        typeof sentence.id !== "string" ||
        typeof sentence.en !== "string" ||
        typeof sentence.uk !== "string" ||
        typeof sentence.ru !== "string"
      ) {
        return null;
      }
      const stored: StoredSentence = {
        id: sentence.id,
        en: sentence.en,
        uk: sentence.uk,
        ru: sentence.ru,
      };
      const paragraph = optionalParagraph(sentence.paragraph);
      if (paragraph !== undefined) stored.paragraph = paragraph;
      sentences.push(stored);
    }
    chapters.push({ id: chapter.id, title: chapterTitle, sentences });
  }
  return { id, author: "", title, chapters };
}

function requiredTitle(value: unknown): Record<"uk" | "ru" | "en", string> | null {
  const title = localeTitle(value);
  if (title === null) return null;
  if (title.uk.trim() === "" || title.ru.trim() === "" || title.en.trim() === "") return null;
  return title;
}

function optionalParagraph(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function parseCatalogSentence(value: unknown, allowBlankTranslation = false): StoredSentence | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.en !== "string" ||
    typeof value.uk !== "string" ||
    typeof value.ru !== "string" ||
    value.en.trim() === "" ||
    (!allowBlankTranslation && value.uk.trim() === "" && value.ru.trim() === "")
  ) {
    return null;
  }
  const sentence: StoredSentence = { id: value.id, en: value.en, uk: value.uk, ru: value.ru };
  const paragraph = optionalParagraph(value.paragraph);
  if (paragraph !== undefined) sentence.paragraph = paragraph;
  return sentence;
}

function parseCatalogBody(body: string): Book | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.id !== "string" || typeof parsed.author !== "string") return null;
  if (parsed.author.trim() === "" || getCatalogBook(parsed.id)) return null;
  const title = requiredTitle(parsed.title);
  if (title === null || !Array.isArray(parsed.chapters) || parsed.chapters.length < 1) return null;
  const chapters: StoredChapter[] = [];
  for (const chapter of parsed.chapters) {
    if (!isRecord(chapter) || typeof chapter.id !== "string") return null;
    const chapterTitle = requiredTitle(chapter.title);
    if (
      chapterTitle === null ||
      !Array.isArray(chapter.sentences) ||
      chapter.sentences.length < 1
    ) {
      return null;
    }
    const sentences: StoredSentence[] = [];
    for (const sentence of chapter.sentences) {
      const parsedSentence = parseCatalogSentence(sentence);
      if (!parsedSentence) return null;
      sentences.push(parsedSentence);
    }
    chapters.push({ id: chapter.id, title: chapterTitle, sentences });
  }
  return { id: parsed.id, author: parsed.author, title, chapters };
}

function parseChapterMeta(parsed: Record<string, unknown>): ChapterMeta | null {
  if (parsed.storage !== "chapters") return null;
  if (typeof parsed.id !== "string" || typeof parsed.author !== "string") return null;
  if (parsed.author.trim() === "" || getCatalogBook(parsed.id)) return null;
  const title = requiredTitle(parsed.title);
  if (
    title === null ||
    typeof parsed.chapterCount !== "number" ||
    !Number.isInteger(parsed.chapterCount) ||
    parsed.chapterCount < 1 ||
    typeof parsed.sentenceCount !== "number" ||
    !Number.isInteger(parsed.sentenceCount) ||
    parsed.sentenceCount < 1
  ) {
    return null;
  }
  return {
    id: parsed.id,
    author: parsed.author,
    title,
    chapterCount: parsed.chapterCount,
    sentenceCount: parsed.sentenceCount,
  };
}

function stubBook(meta: ChapterMeta): Book {
  return {
    id: meta.id,
    author: meta.author,
    title: meta.title,
    chapters: Array.from({ length: meta.chapterCount }, (_, index) => ({
      id: `c${index + 1}`,
      title: meta.title,
      sentences: [],
    })),
  };
}

function parseStoredChapter(body: string): StoredChapter | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.id !== "string") return null;
  const title = requiredTitle(parsed.title);
  if (title === null || !Array.isArray(parsed.sentences) || parsed.sentences.length < 1)
    return null;
  const sentences: StoredSentence[] = [];
  for (const sentence of parsed.sentences) {
    const parsedSentence = parseCatalogSentence(sentence, true);
    if (!parsedSentence) return null;
    sentences.push(parsedSentence);
  }
  return { id: parsed.id, title, sentences };
}

const bookCacheLimit = 8;
const chapterCacheLimit = 64;
const outlineCacheLimit = 32;
const catalogTtlMs = 60_000;
const summaryTtlMs = 60_000;
const catalogListPage = 200;
const catalogListSafety = 50_000;

type CachedBook = { book: Book; revision: string; at: number };
type CachedChapter = { chapter: StoredChapter; revision: string; at: number };
type OutlineChapter = { id: string; title: Record<"uk" | "ru" | "en", string> };
type CachedOutline = { chapters: OutlineChapter[]; revision: string; at: number };
type RevisionHit = { revision: string; at: number };

const bookCache = new Map<string, CachedBook>();
const chapterCache = new Map<string, CachedChapter>();
const outlineCache = new Map<string, CachedOutline>();
const revisionCache = new Map<string, RevisionHit>();
let summaryCache: {
  at: number;
  revision: string;
  books: StoredCatalogRecord[];
  truncated: boolean;
} | null = null;

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const bundledRevision = fnv1a(JSON.stringify(catalogBooks));

function chapterKey(bookId: string, position: number): string {
  return `${bookId}\0${position}`;
}

function dropCachedBodies(bookId: string): void {
  bookCache.delete(bookId);
  outlineCache.delete(bookId);
  for (const key of chapterCache.keys()) {
    if (key.startsWith(`${bookId}\0`)) chapterCache.delete(key);
  }
}

function dropBook(bookId: string): void {
  dropCachedBodies(bookId);
  revisionCache.delete(bookId);
}

function noteRevision(bookId: string, revision: string): void {
  revisionCache.set(bookId, { revision, at: Date.now() });
}

function rememberBook(book: Book, revision: string): Book {
  bookCache.delete(book.id);
  bookCache.set(book.id, { book, revision, at: Date.now() });
  noteRevision(book.id, revision);
  while (bookCache.size > bookCacheLimit) {
    const oldest = bookCache.keys().next().value;
    if (oldest === undefined) break;
    bookCache.delete(oldest);
  }
  return book;
}

function rememberChapter(
  bookId: string,
  position: number,
  revision: string,
  chapter: StoredChapter,
): StoredChapter {
  const key = chapterKey(bookId, position);
  chapterCache.delete(key);
  chapterCache.set(key, { chapter, revision, at: Date.now() });
  while (chapterCache.size > chapterCacheLimit) {
    const oldest = chapterCache.keys().next().value;
    if (oldest === undefined) break;
    chapterCache.delete(oldest);
  }
  return chapter;
}

function rememberOutline(bookId: string, revision: string, chapters: OutlineChapter[]): void {
  outlineCache.delete(bookId);
  outlineCache.set(bookId, { chapters, revision, at: Date.now() });
  while (outlineCache.size > outlineCacheLimit) {
    const oldest = outlineCache.keys().next().value;
    if (oldest === undefined) break;
    outlineCache.delete(oldest);
  }
}

export function invalidateCatalogCache(bookId?: string): void {
  summaryCache = null;
  if (bookId === undefined) {
    bookCache.clear();
    chapterCache.clear();
    outlineCache.clear();
    revisionCache.clear();
    return;
  }
  dropBook(bookId);
}

export function catalogRevision(): string {
  return summaryCache?.revision ?? "0";
}

export function bookRevision(bookId: string): string | null {
  if (getCatalogBook(bookId)) return bundledRevision;
  return revisionCache.get(bookId)?.revision ?? bookCache.get(bookId)?.revision ?? null;
}

async function createdAtOfBook(bookId: string): Promise<string | null> {
  const row = await database()
    .prepare("SELECT created_at FROM catalog_books WHERE id = ?")
    .bind(bookId)
    .first<{ created_at: number }>();
  if (!row) return null;
  return String(row.created_at);
}

/** Book revision for download and catalog ETags. Null when the id is not a public book. */
export async function catalogBookRevision(bookId: string): Promise<string | null> {
  if (getCatalogBook(bookId)) return bundledRevision;
  const known = revisionCache.get(bookId);
  if (known && Date.now() - known.at < catalogTtlMs) return known.revision;
  const revision = await createdAtOfBook(bookId);
  if (revision === null) {
    dropBook(bookId);
    return null;
  }
  if (known && known.revision !== revision) dropCachedBodies(bookId);
  noteRevision(bookId, revision);
  return revision;
}

async function reuseRevision(bookId: string, revision: string): Promise<boolean> {
  const current = await createdAtOfBook(bookId);
  if (current === null || current !== revision) {
    dropBook(bookId);
    return false;
  }
  noteRevision(bookId, current);
  return true;
}

type CatalogListRow = {
  id: string;
  author: string | null;
  title_en: string | null;
  title_uk: string | null;
  title_ru: string | null;
  chapter_count: number | null;
  sentence_count: number | null;
  storage: string | null;
  languages_json: string | null;
  uk_filled: number | null;
  ru_filled: number | null;
};

const catalogListSql = `SELECT id,
  json_extract(body_json, '$.storage') AS storage,
  json_extract(body_json, '$.author') AS author,
  json_extract(body_json, '$.title.en') AS title_en,
  json_extract(body_json, '$.title.uk') AS title_uk,
  json_extract(body_json, '$.title.ru') AS title_ru,
  CASE WHEN json_extract(body_json, '$.storage') IN ('chapters', 'importing')
    THEN json_extract(body_json, '$.chapterCount')
    ELSE json_array_length(body_json, '$.chapters') END AS chapter_count,
  CASE WHEN json_extract(body_json, '$.storage') IN ('chapters', 'importing')
    THEN json_extract(body_json, '$.sentenceCount')
    ELSE (
      SELECT COALESCE(SUM(json_array_length(json_extract(chapter.value, '$.sentences'))), 0)
      FROM json_each(catalog_books.body_json, '$.chapters') AS chapter
    ) END AS sentence_count,
  json_extract(body_json, '$.languages') AS languages_json,
  (
    SELECT COUNT(*)
    FROM json_each(catalog_books.body_json, '$.chapters') AS chapter,
         json_each(json_extract(chapter.value, '$.sentences')) AS sentence
    WHERE TRIM(COALESCE(json_extract(sentence.value, '$.uk'), '')) != ''
  ) AS uk_filled,
  (
    SELECT COUNT(*)
    FROM json_each(catalog_books.body_json, '$.chapters') AS chapter,
         json_each(json_extract(chapter.value, '$.sentences')) AS sentence
    WHERE TRIM(COALESCE(json_extract(sentence.value, '$.ru'), '')) != ''
  ) AS ru_filled
FROM catalog_books
ORDER BY created_at DESC, id DESC`;

function recordFromListRow(row: CatalogListRow): StoredCatalogRecord | null {
  if (getCatalogBook(row.id)) return null;
  const storage = row.storage ?? "";
  if (storage !== "" && storage !== "chapters" && storage !== "importing") return null;
  const author = row.author ?? "";
  const title = requiredTitle({
    en: row.title_en ?? "",
    uk: row.title_uk ?? "",
    ru: row.title_ru ?? "",
  });
  const chapterCount = Number(row.chapter_count);
  const sentenceTotal = Number(row.sentence_count);
  if (author.trim() === "" || title === null) return null;
  if (!Number.isInteger(chapterCount) || chapterCount < 1) return null;
  if (!Number.isInteger(sentenceTotal) || sentenceTotal < 0) return null;
  return {
    book: stubBook({
      id: row.id,
      author,
      title,
      chapterCount,
      sentenceCount: sentenceTotal,
    }),
    sentenceTotal,
    languages: languagesFromRow(row),
    incomplete: storage === "importing",
  };
}

function languagesFromRow(row: CatalogListRow): TranslationCode[] {
  const stored = parseLanguageList(row.languages_json);
  if (stored !== null) return stored;
  const languages: TranslationCode[] = [];
  if (Number(row.uk_filled) > 0) languages.push("uk");
  if (Number(row.ru_filled) > 0) languages.push("ru");
  return languages;
}

function parseLanguageList(value: string | null): TranslationCode[] | null {
  if (value === null || value === "") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    const languages: TranslationCode[] = [];
    if (parsed.includes("uk")) languages.push("uk");
    if (parsed.includes("ru")) languages.push("ru");
    return languages;
  } catch {
    return null;
  }
}

function languagesFromChapter(body: string): TranslationCode[] {
  let ukrainian = false;
  let russian = false;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.sentences)) return [];
    for (const sentence of parsed.sentences) {
      if (!isRecord(sentence)) continue;
      if (!ukrainian && typeof sentence.uk === "string" && sentence.uk.trim() !== "") ukrainian = true;
      if (!russian && typeof sentence.ru === "string" && sentence.ru.trim() !== "") russian = true;
    }
  } catch {
    return [];
  }
  const languages: TranslationCode[] = [];
  if (ukrainian) languages.push("uk");
  if (russian) languages.push("ru");
  return languages;
}

async function queryCatalogList(): Promise<{ books: StoredCatalogRecord[]; truncated: boolean }> {
  const db = database();
  const books: StoredCatalogRecord[] = [];
  let offset = 0;
  for (;;) {
    const result = await db
      .prepare(`${catalogListSql} LIMIT ? OFFSET ?`)
      .bind(catalogListPage, offset)
      .all<CatalogListRow>();
    for (const row of result.results) {
      const item = recordFromListRow(row);
      if (item && item.book.id === row.id) books.push(item);
    }
    if (result.results.length < catalogListPage) break;
    offset += catalogListPage;
    if (offset >= catalogListSafety) return { books, truncated: true };
  }
  await backfillChapterLanguages(books);
  return { books, truncated: false };
}

async function backfillChapterLanguages(books: StoredCatalogRecord[]): Promise<void> {
  const missing = books.filter((item) => item.languages.length === 0 && item.incomplete !== true);
  if (missing.length === 0) return;
  const db = database();
  const ids = missing.map((item) => item.book.id);
  const chapters = await db
    .prepare(
      `SELECT book_id, body_json FROM catalog_chapters
       WHERE position = 0 AND book_id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(...ids)
    .all<{ book_id: string; body_json: string }>();
  const byBook = new Map(chapters.results.map((row) => [row.book_id, row.body_json]));
  for (const item of missing) {
    const body = byBook.get(item.book.id);
    if (body === undefined) continue;
    const languages = languagesFromChapter(body);
    if (languages.length === 0) continue;
    item.languages = languages;
    try {
      const row = await db
        .prepare("SELECT body_json FROM catalog_books WHERE id = ?")
        .bind(item.book.id)
        .first<{ body_json: string }>();
      if (!row) continue;
      const parsed = JSON.parse(row.body_json) as unknown;
      if (!isRecord(parsed) || parsed.storage !== "chapters" || Array.isArray(parsed.languages)) {
        continue;
      }
      parsed.languages = languages;
      await db
        .prepare("UPDATE catalog_books SET body_json = ? WHERE id = ? AND body_json = ?")
        .bind(JSON.stringify(parsed), item.book.id, row.body_json)
        .run();
    } catch {
      // The badge can still use the chapter that was just read.
    }
  }
}

async function readListRevision(): Promise<string> {
  const row = await database()
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(MAX(created_at), 0) AS revision
       FROM catalog_books
       WHERE COALESCE(json_extract(body_json, '$.storage'), '') != 'importing'`,
    )
    .first<{ count: number; revision: number }>();
  return `${bundledRevision}-${row?.count ?? 0}-${row?.revision ?? 0}`;
}

async function listStoredCatalogBooks(options?: {
  fresh?: boolean;
  includeImporting?: boolean;
}): Promise<{ books: StoredCatalogRecord[]; truncated: boolean; stale: boolean; revision: string }> {
  const visible = (books: StoredCatalogRecord[]) =>
    options?.includeImporting ? books : books.filter((item) => item.incomplete !== true);
  if (!options?.fresh && summaryCache !== null && Date.now() - summaryCache.at < summaryTtlMs) {
    return {
      books: visible(summaryCache.books),
      truncated: summaryCache.truncated,
      stale: false,
      revision: summaryCache.revision,
    };
  }
  try {
    const loaded = await queryCatalogList();
    const revision = await readListRevision();
    if (!loaded.truncated) {
      summaryCache = {
        at: Date.now(),
        revision,
        books: loaded.books,
        truncated: false,
      };
    }
    return { books: visible(loaded.books), truncated: loaded.truncated, stale: false, revision };
  } catch (error) {
    if (options?.fresh || summaryCache === null) throw error;
    return {
      books: visible(summaryCache.books),
      truncated: summaryCache.truncated,
      stale: true,
      revision: summaryCache.revision,
    };
  }
}

async function freshLegacyBook(bookId: string): Promise<Book | null> {
  const hit = bookCache.get(bookId);
  if (!hit) return null;
  if (Date.now() - hit.at < catalogTtlMs) return hit.book;
  if (!(await reuseRevision(bookId, hit.revision))) return null;
  hit.at = Date.now();
  return hit.book;
}

async function readOutline(meta: ChapterMeta, revision: string): Promise<OutlineChapter[] | null> {
  const hit = outlineCache.get(meta.id);
  if (hit && hit.revision === revision) {
    if (Date.now() - hit.at < catalogTtlMs) return hit.chapters;
    if (!(await reuseRevision(meta.id, revision))) return null;
    hit.at = Date.now();
    return hit.chapters;
  }
  const rows = await database()
    .prepare(
      `SELECT position, chapter_id,
         json_extract(body_json, '$.title.en') AS title_en,
         json_extract(body_json, '$.title.uk') AS title_uk,
         json_extract(body_json, '$.title.ru') AS title_ru
       FROM catalog_chapters WHERE book_id = ? ORDER BY position`,
    )
    .bind(meta.id)
    .all<{
      position: number;
      chapter_id: string;
      title_en: string | null;
      title_uk: string | null;
      title_ru: string | null;
    }>();
  if (rows.results.length !== meta.chapterCount) return null;
  const chapters: OutlineChapter[] = [];
  for (let index = 0; index < rows.results.length; index += 1) {
    const row = rows.results[index];
    if (!row || row.position !== index || row.chapter_id !== `c${index + 1}`) return null;
    const title = requiredTitle({
      en: row.title_en ?? "",
      uk: row.title_uk ?? "",
      ru: row.title_ru ?? "",
    });
    if (title === null) return null;
    chapters.push({ id: row.chapter_id, title });
  }
  rememberOutline(meta.id, revision, chapters);
  return chapters;
}

async function readChapterBody(
  bookId: string,
  position: number,
  chapterId: string,
  revision: string,
): Promise<StoredChapter | null> {
  const key = chapterKey(bookId, position);
  const hit = chapterCache.get(key);
  if (hit && hit.revision === revision && hit.chapter.id === chapterId) {
    if (Date.now() - hit.at < catalogTtlMs) return hit.chapter;
    if (!(await reuseRevision(bookId, revision))) return null;
    hit.at = Date.now();
    return hit.chapter;
  }
  const row = await database()
    .prepare(
      "SELECT chapter_id, body_json FROM catalog_chapters WHERE book_id = ? AND position = ?",
    )
    .bind(bookId, position)
    .first<{ chapter_id: string; body_json: string }>();
  if (!row || row.chapter_id !== chapterId) return null;
  const chapter = parseStoredChapter(row.body_json);
  if (!chapter || chapter.id !== chapterId) return null;
  return rememberChapter(bookId, position, revision, chapter);
}

async function readChapterPart(
  meta: ChapterMeta,
  chapterId: string,
  revision: string,
): Promise<Book | null> {
  const outline = await readOutline(meta, revision);
  if (!outline) return null;
  const index = outline.findIndex((chapter) => chapter.id === chapterId);
  if (index < 0) return null;
  const open = await readChapterBody(meta.id, index, chapterId, revision);
  if (!open) return null;
  return {
    id: meta.id,
    author: meta.author,
    title: meta.title,
    chapters: outline.map((chapter, chapterIndex) =>
      chapterIndex === index ? open : { id: chapter.id, title: chapter.title, sentences: [] },
    ),
  };
}

async function readChapterBook(meta: ChapterMeta, revision: string): Promise<Book | null> {
  const outline = await readOutline(meta, revision);
  if (!outline) return null;
  const cached: StoredChapter[] = [];
  for (let index = 0; index < outline.length; index += 1) {
    const hit = chapterCache.get(chapterKey(meta.id, index));
    if (!hit || hit.revision !== revision || Date.now() - hit.at >= catalogTtlMs) break;
    const chapter = outline[index];
    if (!chapter || hit.chapter.id !== chapter.id) break;
    cached.push(hit.chapter);
  }
  if (cached.length === outline.length) {
    return { id: meta.id, author: meta.author, title: meta.title, chapters: cached };
  }
  const rows = await database()
    .prepare(
      "SELECT position, chapter_id, body_json FROM catalog_chapters WHERE book_id = ? ORDER BY position ASC",
    )
    .bind(meta.id)
    .all<{ position: number; chapter_id: string; body_json: string }>();
  if (rows.results.length !== meta.chapterCount) return null;
  const chapters: StoredChapter[] = [];
  for (let index = 0; index < rows.results.length; index += 1) {
    const row = rows.results[index];
    if (!row || row.position !== index) return null;
    const chapter = parseStoredChapter(row.body_json);
    if (!chapter || chapter.id !== row.chapter_id || chapter.id !== `c${index + 1}`) return null;
    chapters.push(rememberChapter(meta.id, index, revision, chapter));
  }
  return { id: meta.id, author: meta.author, title: meta.title, chapters };
}

async function readCatalogMeta(bookId: string): Promise<
  | { kind: "missing" }
  | { kind: "hidden" }
  | { kind: "legacy"; book: Book }
  | { kind: "chapters"; meta: ChapterMeta; revision: string }
> {
  const legacy = await freshLegacyBook(bookId);
  if (legacy) return { kind: "legacy", book: legacy };
  const row = await database()
    .prepare("SELECT body_json, created_at FROM catalog_books WHERE id = ?")
    .bind(bookId)
    .first<{ body_json: string; created_at: number }>();
  if (!row) {
    dropBook(bookId);
    return { kind: "missing" };
  }
  const revision = String(row.created_at);
  noteRevision(bookId, revision);
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.body_json);
  } catch {
    return { kind: "hidden" };
  }
  if (!isRecord(parsed) || parsed.storage === "importing") return { kind: "hidden" };
  if (parsed.storage === "chapters") {
    const meta = parseChapterMeta(parsed);
    if (!meta || meta.id !== bookId) return { kind: "hidden" };
    return { kind: "chapters", meta, revision };
  }
  const book = parseCatalogBody(row.body_json);
  if (!book || book.id !== bookId) return { kind: "hidden" };
  return { kind: "legacy", book: rememberBook(book, revision) };
}

async function readStoredCatalogBook(bookId: string): Promise<Book | null> {
  const meta = await readCatalogMeta(bookId);
  if (meta.kind === "missing" || meta.kind === "hidden") return null;
  if (meta.kind === "legacy") return meta.book;
  return readChapterBook(meta.meta, meta.revision);
}

async function readStoredCatalogChapter(
  bookId: string,
  chapterId: string,
): Promise<Book | null | undefined> {
  const meta = await readCatalogMeta(bookId);
  if (meta.kind === "missing") return undefined;
  if (meta.kind === "hidden") return null;
  if (meta.kind === "legacy") return chapterView(meta.book, chapterId);
  return readChapterPart(meta.meta, chapterId, meta.revision);
}

function uploadedBook(
  id: string,
  title: string,
  sentences: readonly { text: string; paragraph?: number }[],
): Book {
  const localized = { uk: title, ru: title, en: title };
  return {
    id,
    author: "",
    title: localized,
    chapters: [
      {
        id: "c1",
        title: localized,
        sentences: sentences.map((sentence, index) => ({
          id: `s${index + 1}`,
          en: sentence.text,
          uk: "",
          ru: "",
          paragraph: sentence.paragraph ?? 0,
        })),
      },
    ],
  };
}

function newUserBookId(): string {
  return crypto.randomUUID();
}

export async function readReaderBook(bookId: string, userId: string | null): Promise<Book | null> {
  const bundled = getCatalogBook(bookId);
  if (bundled) return bundled;
  const stored = await readStoredCatalogBook(bookId);
  if (stored) return stored;
  if (userId === null) return null;
  const row = await database()
    .prepare("SELECT body_json FROM user_books WHERE id = ? AND user_id = ?")
    .bind(bookId, userId)
    .first<{ body_json: string }>();
  if (!row) return null;
  return parseStoredBook(row.body_json, bookId);
}

export async function readReaderChapter(
  bookId: string,
  chapterId: string,
  resolveUserId: () => Promise<string | null>,
): Promise<Book | null> {
  const bundled = getCatalogBook(bookId);
  if (bundled) return chapterView(bundled, chapterId);
  const stored = await readStoredCatalogChapter(bookId, chapterId);
  if (stored !== undefined) return stored;
  const userId = await resolveUserId();
  if (userId === null) return null;
  const row = await database()
    .prepare("SELECT body_json FROM user_books WHERE id = ? AND user_id = ?")
    .bind(bookId, userId)
    .first<{ body_json: string }>();
  if (!row) return null;
  const owned = parseStoredBook(row.body_json, bookId);
  if (!owned) return null;
  return chapterView(owned, chapterId);
}

export async function listMyBooks(userId: string): Promise<
  {
    id: string;
    title: string;
    author: string;
    alignment: "pending" | "ready";
    alignmentPending: boolean;
    chapterCount: number;
    sentenceCount: number;
    createdAt: number;
    languages: TranslationCode[];
  }[]
> {
  const result = await database()
    .prepare(
      `SELECT id, title, alignment, created_at,
              CASE WHEN json_array_length(body_json, '$.chapters') IS NULL THEN 1
                   ELSE json_array_length(body_json, '$.chapters') END AS chapter_count,
              (
                SELECT COALESCE(SUM(json_array_length(json_extract(chapter.value, '$.sentences'))), 0)
                FROM json_each(user_books.body_json, '$.chapters') AS chapter
              ) AS sentence_count
       FROM user_books
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
    )
    .bind(userId)
    .all<{
      id: string;
      title: string;
      alignment: string;
      created_at: number;
      chapter_count: number | null;
      sentence_count: number | null;
    }>();
  return result.results.map((row) => {
    const alignment = row.alignment === "ready" ? "ready" : "pending";
    return {
      id: row.id,
      title: row.title,
      author: "",
      alignment,
      alignmentPending: alignment !== "ready",
      chapterCount: Number(row.chapter_count ?? 1),
      sentenceCount: Number(row.sentence_count ?? 0),
      createdAt: Number(row.created_at ?? 0),
      languages: alignment === "ready" ? ["uk", "ru"] : [],
    };
  });
}

export type StoredProgress = {
  bookId: string;
  chapterId: string;
  sentenceId: string | null;
  updatedAt: number;
};

function progressFromRow(row: {
  book_id: string;
  chapter_id: string;
  sentence_id: string | null;
  updated_at: number;
}): StoredProgress {
  return {
    bookId: row.book_id,
    chapterId: row.chapter_id,
    sentenceId: row.sentence_id,
    updatedAt: row.updated_at,
  };
}

export async function readBookProgress(
  userId: string,
  bookId: string,
): Promise<StoredProgress | null> {
  const row = await database()
    .prepare(
      `SELECT book_id, chapter_id, sentence_id, updated_at
       FROM progress
       WHERE user_id = ? AND book_id = ?`,
    )
    .bind(userId, bookId)
    .first<{
      book_id: string;
      chapter_id: string;
      sentence_id: string | null;
      updated_at: number;
    }>();
  if (!row) return null;
  return progressFromRow(row);
}

export async function listUserProgress(userId: string): Promise<StoredProgress[]> {
  const result = await database()
    .prepare(
      `SELECT book_id, chapter_id, sentence_id, updated_at
       FROM progress
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 200`,
    )
    .bind(userId)
    .all<{
      book_id: string;
      chapter_id: string;
      sentence_id: string | null;
      updated_at: number;
    }>();
  return result.results.map(progressFromRow);
}

export async function latestProgress(userId: string): Promise<StoredProgress | null> {
  const rows = await listUserProgress(userId);
  return rows[0] ?? null;
}

export async function saveReadingProgress(
  userId: string,
  input: { bookId: string; chapterId: string; sentenceId: string | null },
): Promise<"saved" | "refused"> {
  const db = database();
  if (getCatalogBook(input.bookId) === null) {
    const stored = await db
      .prepare("SELECT id FROM catalog_books WHERE id = ?")
      .bind(input.bookId)
      .first<{ id: string }>();
    if (!stored) {
      const owned = await db
        .prepare("SELECT id FROM user_books WHERE id = ? AND user_id = ?")
        .bind(input.bookId, userId)
        .first<{ id: string }>();
      if (!owned) return "refused";
    }
  }
  await db
    .prepare(
      `INSERT INTO progress (user_id, book_id, chapter_id, sentence_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, book_id) DO UPDATE SET
         chapter_id = excluded.chapter_id,
         sentence_id = excluded.sentence_id,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, input.bookId, input.chapterId, input.sentenceId, Date.now())
    .run();
  return "saved";
}

export const userUploadLimit = 50;
export const userUploadHourlyLimit = 20;
export const ownedUploadBodyBytes = 1_500_000;

export class UploadQuotaError extends Error {
  constructor() {
    super("quota");
    this.name = "UploadQuotaError";
  }
}

export class UploadRateError extends Error {
  constructor() {
    super("rate");
    this.name = "UploadRateError";
  }
}

export async function insertUserBook(
  userId: string,
  title: string,
  sentences: readonly { text: string; paragraph?: number }[],
): Promise<string> {
  const id = newUserBookId();
  const book = uploadedBook(id, title, sentences);
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const inserted = await database()
    .prepare(
      `INSERT INTO user_books (id, user_id, title, body_json, alignment, created_at)
       SELECT ?, ?, ?, ?, 'pending', ?
       WHERE (SELECT COUNT(*) FROM user_books WHERE user_id = ?) < ?
         AND (SELECT COUNT(*) FROM user_books WHERE user_id = ? AND created_at > ?) < ?`,
    )
    .bind(
      id,
      userId,
      title,
      JSON.stringify(book),
      now,
      userId,
      userUploadLimit,
      userId,
      hourAgo,
      userUploadHourlyLimit,
    )
    .run();
  if ((inserted.meta.changes ?? 0) < 1) {
    const counts = await database()
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM user_books WHERE user_id = ?) AS total,
           (SELECT COUNT(*) FROM user_books WHERE user_id = ? AND created_at > ?) AS recent`,
      )
      .bind(userId, userId, hourAgo)
      .first<{ total: number; recent: number }>();
    if ((counts?.recent ?? 0) >= userUploadHourlyLimit) throw new UploadRateError();
    throw new UploadQuotaError();
  }
  return id;
}

export type OwnedUpload = {
  alignment: "pending" | "ready";
  bodyJson: string;
  body: unknown;
  sentences: { id: string; en: string; uk: string; ru: string }[];
};

function uploadSentences(body: unknown): OwnedUpload["sentences"] | null {
  if (!isRecord(body) || !Array.isArray(body.chapters)) return null;
  const sentences: OwnedUpload["sentences"] = [];
  for (const chapter of body.chapters) {
    if (!isRecord(chapter) || !Array.isArray(chapter.sentences)) return null;
    for (const sentence of chapter.sentences) {
      if (!isRecord(sentence) || typeof sentence.id !== "string") continue;
      sentences.push({
        id: sentence.id,
        en: typeof sentence.en === "string" ? sentence.en : "",
        uk: typeof sentence.uk === "string" ? sentence.uk : "",
        ru: typeof sentence.ru === "string" ? sentence.ru : "",
      });
    }
  }
  return sentences;
}

export async function readOwnedUpload(userId: string, bookId: string): Promise<OwnedUpload | null> {
  const row = await database()
    .prepare("SELECT body_json, alignment FROM user_books WHERE id = ? AND user_id = ?")
    .bind(bookId, userId)
    .first<{ body_json: string; alignment: string }>();
  if (!row) return null;
  let body: unknown;
  try {
    body = JSON.parse(row.body_json);
  } catch {
    return null;
  }
  const sentences = uploadSentences(body);
  if (sentences === null) return null;
  return {
    alignment: row.alignment === "ready" ? "ready" : "pending",
    bodyJson: row.body_json,
    body,
    sentences,
  };
}

export async function updateOwnedUpload(
  userId: string,
  bookId: string,
  previousBodyJson: string,
  nextBodyJson: string,
  alignment: "pending" | "ready",
): Promise<{ status: "saved"; changes: number } | { status: "too-large" }> {
  if (new TextEncoder().encode(nextBodyJson).byteLength > ownedUploadBodyBytes) {
    return { status: "too-large" };
  }
  const result = await database()
    .prepare(
      `UPDATE user_books
       SET body_json = ?, alignment = ?
       WHERE id = ? AND user_id = ? AND body_json = ?`,
    )
    .bind(nextBodyJson, alignment, bookId, userId, previousBodyJson)
    .run();
  return { status: "saved", changes: result.meta.changes };
}

export async function deleteOwnedBook(
  userId: string,
  bookId: string,
): Promise<"deleted" | "missing"> {
  const db = database();
  const owned = await db
    .prepare("SELECT id FROM user_books WHERE id = ? AND user_id = ?")
    .bind(bookId, userId)
    .first<{ id: string }>();
  if (!owned) return "missing";
  await db.batch([
    db.prepare("DELETE FROM progress WHERE user_id = ? AND book_id = ?").bind(userId, bookId),
    db.prepare("DELETE FROM user_books WHERE id = ? AND user_id = ?").bind(bookId, userId),
  ]);
  return "deleted";
}

export async function renameOwnedBook(
  userId: string,
  bookId: string,
  title: string,
): Promise<"renamed" | "missing" | "invalid"> {
  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 120) return "invalid";
  const db = database();
  const row = await db
    .prepare("SELECT body_json FROM user_books WHERE id = ? AND user_id = ?")
    .bind(bookId, userId)
    .first<{ body_json: string }>();
  if (!row) return "missing";
  let body: unknown;
  try {
    body = JSON.parse(row.body_json);
  } catch {
    return "missing";
  }
  if (isRecord(body) && isRecord(body.title)) {
    body.title.en = trimmed;
    body.title.uk = trimmed;
    body.title.ru = trimmed;
  }
  if (isRecord(body) && Array.isArray(body.chapters)) {
    for (const chapter of body.chapters) {
      if (!isRecord(chapter) || !isRecord(chapter.title)) continue;
      chapter.title.en = trimmed;
      chapter.title.uk = trimmed;
      chapter.title.ru = trimmed;
    }
  }
  const updated = await db
    .prepare("UPDATE user_books SET title = ?, body_json = ? WHERE id = ? AND user_id = ?")
    .bind(trimmed, JSON.stringify(body), bookId, userId)
    .run();
  if ((updated.meta.changes ?? 0) < 1) return "missing";
  return "renamed";
}

export async function listCatalogSummaries(): Promise<{
  books: BookSummary[];
  revision: string;
  stale: boolean;
}> {
  const bundled = catalogBooks.map((book: Book) => bookSummary(book));
  const stored = await listStoredCatalogBooks();
  if (stored.truncated) throw new Error("catalog truncated");
  return {
    books: [
      ...stored.books.map((item) => ({
        ...bookSummary(item.book),
        sentenceCount: item.sentenceTotal,
        languages: item.languages,
      })),
      ...bundled,
    ],
    revision: stored.revision,
    stale: stored.stale,
  };
}

export async function readPublicCatalogBook(bookId: string): Promise<Book | null> {
  const bundled = getCatalogBook(bookId);
  if (bundled) return bundled;
  return readStoredCatalogBook(bookId);
}

export async function readPublicCatalogChapter(
  bookId: string,
  chapterId: string,
): Promise<Book | null> {
  const bundled = getCatalogBook(bookId);
  if (bundled) return chapterView(bundled, chapterId);
  const stored = await readStoredCatalogChapter(bookId, chapterId);
  return stored ?? null;
}

export async function insertCatalogBook(
  book: PreparedCatalogBook,
): Promise<"saved" | "duplicate" | "reserved"> {
  if (getCatalogBook(book.id)) return "reserved";
  const db = database();
  const clash = await db
    .prepare(
      `SELECT id FROM catalog_books WHERE id = ?
       UNION
       SELECT id FROM user_books WHERE id = ?`,
    )
    .bind(book.id, book.id)
    .first<{ id: string }>();
  if (clash) return "duplicate";
  try {
    await db
      .prepare("INSERT INTO catalog_books (id, body_json, created_at) VALUES (?, ?, ?)")
      .bind(book.id, JSON.stringify(book), Date.now())
      .run();
    invalidateCatalogCache(book.id);
    return "saved";
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (text.includes("UNIQUE")) return "duplicate";
    throw error;
  }
}

const chapterChunk = 40;
const importingStaleMs = 10 * 60 * 1000;

function isUniqueError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("UNIQUE");
}

function isStaleImport(body: string, createdAt: number, bookId: string): boolean {
  if (Date.now() - createdAt < importingStaleMs) return false;
  try {
    const parsed = JSON.parse(body) as unknown;
    return isRecord(parsed) && parsed.storage === "importing" && parsed.id === bookId;
  } catch {
    return false;
  }
}

async function claimStaleImport(
  bookId: string,
  staleBody: string,
  placeholder: string,
): Promise<boolean> {
  const db = database();
  const claimed = await db.batch([
    db
      .prepare(
        "UPDATE catalog_books SET body_json = ?, created_at = ? WHERE id = ? AND body_json = ?",
      )
      .bind(placeholder, Date.now(), bookId, staleBody),
    db
      .prepare(
        `DELETE FROM catalog_chapters WHERE book_id = ? AND EXISTS (
           SELECT 1 FROM catalog_books WHERE id = ? AND body_json = ?
         )`,
      )
      .bind(bookId, bookId, placeholder),
  ]);
  return (claimed[0]?.meta.changes ?? 0) >= 1;
}

async function rollbackOwnedImport(bookId: string, placeholder: string): Promise<void> {
  const db = database();
  await db.batch([
    db
      .prepare(
        `DELETE FROM catalog_chapters WHERE book_id = ? AND EXISTS (
           SELECT 1 FROM catalog_books WHERE id = ? AND body_json = ?
         )`,
      )
      .bind(bookId, bookId, placeholder),
    db
      .prepare("DELETE FROM catalog_books WHERE id = ? AND body_json = ?")
      .bind(bookId, placeholder),
  ]);
}

export async function insertImportedCatalogBook(
  book: TwoBooksCatalog,
): Promise<"saved" | "duplicate" | "reserved"> {
  if (getCatalogBook(book.id)) return "reserved";
  const db = database();
  const userClash = await db
    .prepare("SELECT id FROM user_books WHERE id = ?")
    .bind(book.id)
    .first<{ id: string }>();
  if (userClash) return "duplicate";
  const sentenceCount = book.chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0);
  const languages = translationLanguages(book);
  const placeholder = JSON.stringify({
    storage: "importing",
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
    sentenceCount,
    languages,
    token: crypto.randomUUID(),
    startedAt: Date.now(),
  });
  const meta = JSON.stringify({
    storage: "chapters",
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
    sentenceCount,
    languages,
  });
  const bodies = book.chapters.map((chapter) =>
    JSON.stringify({ id: chapter.id, title: chapter.title, sentences: chapter.sentences }),
  );
  if (
    book.chapters.length < 1 ||
    placeholder.length > 900_000 ||
    meta.length > 900_000 ||
    bodies.some((body) => body.length > 900_000)
  ) {
    throw new Error("chapter too large");
  }
  const existing = await db
    .prepare("SELECT body_json, created_at FROM catalog_books WHERE id = ?")
    .bind(book.id)
    .first<{ body_json: string; created_at: number }>();
  if (existing) {
    if (!isStaleImport(existing.body_json, existing.created_at, book.id)) return "duplicate";
    if (!(await claimStaleImport(book.id, existing.body_json, placeholder))) return "duplicate";
  } else {
    try {
      await db
        .prepare("INSERT INTO catalog_books (id, body_json, created_at) VALUES (?, ?, ?)")
        .bind(book.id, placeholder, Date.now())
        .run();
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      const raced = await db
        .prepare("SELECT body_json, created_at FROM catalog_books WHERE id = ?")
        .bind(book.id)
        .first<{ body_json: string; created_at: number }>();
      if (!raced || !isStaleImport(raced.body_json, raced.created_at, book.id)) return "duplicate";
      if (!(await claimStaleImport(book.id, raced.body_json, placeholder))) return "duplicate";
    }
  }
  try {
    for (let index = 0; index < book.chapters.length; index += chapterChunk) {
      const owned = await db
        .prepare("SELECT body_json FROM catalog_books WHERE id = ?")
        .bind(book.id)
        .first<{ body_json: string }>();
      if (owned?.body_json !== placeholder) {
        await rollbackOwnedImport(book.id, placeholder);
        return "duplicate";
      }
      const slice = book.chapters.slice(index, index + chapterChunk);
      const last = index + slice.length >= book.chapters.length;
      const inserts = slice.map((chapter, offset) =>
        db
          .prepare(
            `INSERT INTO catalog_chapters (book_id, position, chapter_id, body_json)
             SELECT ?, ?, ?, ?
             WHERE EXISTS (SELECT 1 FROM catalog_books WHERE id = ? AND body_json = ?)`,
          )
          .bind(
            book.id,
            index + offset,
            chapter.id,
            bodies[index + offset] ?? "",
            book.id,
            placeholder,
          ),
      );
      if (!last) {
        const inserted = await db.batch(inserts);
        if (inserted.some((row) => (row.meta.changes ?? 0) < 1)) {
          await rollbackOwnedImport(book.id, placeholder);
          return "duplicate";
        }
        continue;
      }
      const published = await db.batch([
        ...inserts,
        db
          .prepare(
            "UPDATE catalog_books SET body_json = ?, created_at = ? WHERE id = ? AND body_json = ?",
          )
          .bind(meta, Date.now(), book.id, placeholder),
      ]);
      const changes = published[published.length - 1]?.meta.changes ?? 0;
      if (changes < 1) {
        await rollbackOwnedImport(book.id, placeholder);
        return "duplicate";
      }
    }
    invalidateCatalogCache(book.id);
    return "saved";
  } catch (error) {
    await rollbackOwnedImport(book.id, placeholder);
    invalidateCatalogCache(book.id);
    if (isUniqueError(error)) return "duplicate";
    throw error;
  }
}

export async function deleteStoredCatalogBook(bookId: string): Promise<"deleted" | "missing"> {
  if (getCatalogBook(bookId)) return "missing";
  const db = database();
  const row = await db
    .prepare("SELECT id FROM catalog_books WHERE id = ?")
    .bind(bookId)
    .first<{ id: string }>();
  if (!row) return "missing";
  await db.batch([
    db.prepare("DELETE FROM progress WHERE book_id = ?").bind(bookId),
    db.prepare("DELETE FROM catalog_chapters WHERE book_id = ?").bind(bookId),
    db.prepare("DELETE FROM catalog_books WHERE id = ?").bind(bookId),
  ]);
  invalidateCatalogCache(bookId);
  return "deleted";
}

export async function listAdminCatalogBooks(): Promise<{
  books: StoredCatalogRecord[];
  truncated: boolean;
}> {
  return listStoredCatalogBooks({ fresh: true, includeImporting: true });
}
