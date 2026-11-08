import { bookSummary, catalogBooks, getCatalogBook, type Book } from "#/content/catalog";
import type { PreparedCatalogBook } from "#/library/catalog-draft";
import type { TwoBooksCatalog } from "#/library/two-books";

import { database } from "#/auth/db.server";

type StoredSentence = { id: string; en: string; uk: string; ru: string; paragraph?: number };

export type StoredCatalogRecord = {
  book: Book;
  sentenceTotal: number;
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
      sentences.push({ id: sentence.id, en: sentence.en, uk: sentence.uk, ru: sentence.ru });
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

function parseCatalogSentence(value: unknown): StoredSentence | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.en !== "string" ||
    typeof value.uk !== "string" ||
    typeof value.ru !== "string" ||
    value.en.trim() === "" ||
    (value.uk.trim() === "" && value.ru.trim() === "")
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
    const parsedSentence = parseCatalogSentence(sentence);
    if (!parsedSentence) return null;
    sentences.push(parsedSentence);
  }
  return { id: parsed.id, title, sentences };
}

function parseCatalogListItem(body: string): StoredCatalogRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.storage === "chapters") {
    const meta = parseChapterMeta(parsed);
    if (!meta) return null;
    return { book: stubBook(meta), sentenceTotal: meta.sentenceCount };
  }
  const book = parseCatalogBody(body);
  if (!book) return null;
  return {
    book,
    sentenceTotal: book.chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0),
  };
}

async function listStoredCatalogBooks(): Promise<StoredCatalogRecord[]> {
  const result = await database()
    .prepare("SELECT id, body_json FROM catalog_books ORDER BY created_at ASC, id ASC LIMIT 100")
    .all<{ id: string; body_json: string }>();
  const books: StoredCatalogRecord[] = [];
  for (const row of result.results) {
    const item = parseCatalogListItem(row.body_json);
    if (item && item.book.id === row.id) books.push(item);
  }
  return books;
}

async function readChapterBook(meta: ChapterMeta): Promise<Book | null> {
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
    chapters.push(chapter);
  }
  return { id: meta.id, author: meta.author, title: meta.title, chapters };
}

async function readStoredCatalogBook(bookId: string): Promise<Book | null> {
  const row = await database()
    .prepare("SELECT body_json FROM catalog_books WHERE id = ?")
    .bind(bookId)
    .first<{ body_json: string }>();
  if (!row) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.body_json);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.storage === "chapters") {
    const meta = parseChapterMeta(parsed);
    if (!meta || meta.id !== bookId) return null;
    return readChapterBook(meta);
  }
  const book = parseCatalogBody(row.body_json);
  if (!book || book.id !== bookId) return null;
  return book;
}

function uploadedBook(id: string, title: string, sentences: readonly string[]): Book {
  const localized = { uk: title, ru: title, en: title };
  return {
    id,
    author: "",
    title: localized,
    chapters: [
      {
        id: "c1",
        title: localized,
        sentences: sentences.map((en, index) => ({
          id: `s${index + 1}`,
          en,
          uk: "",
          ru: "",
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

export async function listMyBooks(userId: string): Promise<
  {
    id: string;
    title: string;
    author: string;
    alignment: "pending" | "ready";
    alignmentPending: boolean;
  }[]
> {
  const result = await database()
    .prepare(
      "SELECT id, title, alignment FROM user_books WHERE user_id = ? ORDER BY created_at DESC, id DESC",
    )
    .bind(userId)
    .all<{ id: string; title: string; alignment: string }>();
  return result.results.map((row) => {
    const alignment = row.alignment === "ready" ? "ready" : "pending";
    return {
      id: row.id,
      title: row.title,
      author: "",
      alignment,
      alignmentPending: alignment !== "ready",
    };
  });
}

export async function latestProgress(userId: string): Promise<{
  bookId: string;
  chapterId: string;
  sentenceId: string | null;
} | null> {
  const row = await database()
    .prepare(
      `SELECT book_id, chapter_id, sentence_id
       FROM progress
       WHERE user_id = ?
       ORDER BY updated_at DESC, book_id ASC
       LIMIT 1`,
    )
    .bind(userId)
    .first<{ book_id: string; chapter_id: string; sentence_id: string | null }>();
  if (!row) return null;
  return {
    bookId: row.book_id,
    chapterId: row.chapter_id,
    sentenceId: row.sentence_id,
  };
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

export async function insertUserBook(
  userId: string,
  title: string,
  sentences: readonly string[],
): Promise<string> {
  const id = newUserBookId();
  const book = uploadedBook(id, title, sentences);
  await database()
    .prepare(
      `INSERT INTO user_books (id, user_id, title, body_json, alignment, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(id, userId, title, JSON.stringify(book), Date.now())
    .run();
  return id;
}

export async function listCatalogSummaries() {
  const bundled = catalogBooks.map((book: Book) => bookSummary(book));
  try {
    const stored = await listStoredCatalogBooks();
    return [...bundled, ...stored.map((item) => bookSummary(item.book))];
  } catch {
    return bundled;
  }
}

export async function readPublicCatalogBook(bookId: string): Promise<Book | null> {
  const bundled = getCatalogBook(bookId);
  if (bundled) return bundled;
  return readStoredCatalogBook(bookId);
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
    return "saved";
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (text.includes("UNIQUE")) return "duplicate";
    throw error;
  }
}

const chapterChunk = 40;

async function removeImportedRows(bookId: string): Promise<void> {
  const db = database();
  try {
    await db.batch([
      db.prepare("DELETE FROM catalog_chapters WHERE book_id = ?").bind(bookId),
      db.prepare("DELETE FROM catalog_books WHERE id = ?").bind(bookId),
    ]);
  } catch {
    // A failed import may have written neither table.
  }
}

export async function insertImportedCatalogBook(
  book: TwoBooksCatalog,
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
  const sentenceCount = book.chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0);
  const meta = JSON.stringify({
    storage: "chapters",
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
    sentenceCount,
  });
  const bodies = book.chapters.map((chapter) =>
    JSON.stringify({ id: chapter.id, title: chapter.title, sentences: chapter.sentences }),
  );
  if (meta.length > 900_000 || bodies.some((body) => body.length > 900_000)) {
    throw new Error("chapter too large");
  }
  try {
    await db
      .prepare("INSERT INTO catalog_books (id, body_json, created_at) VALUES (?, ?, ?)")
      .bind(book.id, meta, Date.now())
      .run();
    for (let index = 0; index < book.chapters.length; index += chapterChunk) {
      const slice = book.chapters.slice(index, index + chapterChunk);
      await db.batch(
        slice.map((chapter, offset) =>
          db
            .prepare(
              "INSERT INTO catalog_chapters (book_id, position, chapter_id, body_json) VALUES (?, ?, ?, ?)",
            )
            .bind(book.id, index + offset, chapter.id, bodies[index + offset] ?? ""),
        ),
      );
    }
    return "saved";
  } catch (error) {
    await removeImportedRows(book.id);
    const text = error instanceof Error ? error.message : String(error);
    if (text.includes("UNIQUE")) return "duplicate";
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
  return "deleted";
}

export async function listAdminCatalogBooks(): Promise<StoredCatalogRecord[]> {
  return listStoredCatalogBooks();
}
