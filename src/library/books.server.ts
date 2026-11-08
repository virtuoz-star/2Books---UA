import { bookSummary, catalogBooks, getCatalogBook, type Book } from "#/content/catalog";

import { database } from "#/auth/db.server";

const catalogBookId = "gift-of-the-magi";

type StoredSentence = { id: string; en: string; uk: string; ru: string };
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
  if (bookId === catalogBookId) {
    const book = getCatalogBook(bookId);
    return book ?? null;
  }
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
  if (input.bookId !== catalogBookId) {
    const owned = await db
      .prepare("SELECT id FROM user_books WHERE id = ? AND user_id = ?")
      .bind(input.bookId, userId)
      .first<{ id: string }>();
    if (!owned) return "refused";
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

export function listCatalogSummaries() {
  return catalogBooks.map((book: Book) => bookSummary(book));
}

export async function readPublicCatalogBook(bookId: string): Promise<Book | null> {
  if (bookId !== catalogBookId) return null;
  const book = getCatalogBook(bookId);
  return book ?? null;
}
