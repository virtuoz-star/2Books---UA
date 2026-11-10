import { createFileRoute } from "@tanstack/react-router";

import {
  clampSavedWordTimes,
  mergeWordStores,
  parseSavedWordStore,
  savedWordKey,
  type SavedWord,
  type SavedWordStore,
  type WordTombstone,
} from "#/dictionary/saved-words";

const savedWordBodyLimit = 28_300_000;

export async function readBoundedBody(
  request: Request,
  limit = savedWordBodyLimit,
): Promise<{ ok: true; text: string } | { ok: false; status: 411 | 413 }> {
  const declared = request.headers.get("content-length");
  if (declared === null) return { ok: false, status: 411 };
  const size = Number(declared);
  if (!Number.isFinite(size) || size < 0 || size > limit) return { ok: false, status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    const value = step.value;
    if (!value || value.byteLength === 0) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

const liveSql = `INSERT INTO saved_words (
  user_id, word_key, word, gloss, native_language,
  sentence_en, sentence_native, saved_at, deleted_at,
  book_id, chapter_id, sentence_id, book_source
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
ON CONFLICT(user_id, word_key) DO UPDATE SET
  word = excluded.word,
  gloss = excluded.gloss,
  native_language = excluded.native_language,
  sentence_en = excluded.sentence_en,
  sentence_native = excluded.sentence_native,
  saved_at = excluded.saved_at,
  deleted_at = NULL,
  book_id = excluded.book_id,
  chapter_id = excluded.chapter_id,
  sentence_id = excluded.sentence_id,
  book_source = excluded.book_source
WHERE excluded.saved_at > CASE
    WHEN saved_words.deleted_at IS NULL THEN saved_words.saved_at
    ELSE saved_words.deleted_at
  END
  OR (
    saved_words.deleted_at IS NULL
    AND excluded.saved_at = saved_words.saved_at
    AND (
      excluded.gloss > saved_words.gloss
      OR (excluded.gloss = saved_words.gloss AND excluded.sentence_en > saved_words.sentence_en)
      OR (
        excluded.gloss = saved_words.gloss
        AND excluded.sentence_en = saved_words.sentence_en
        AND excluded.sentence_native >= saved_words.sentence_native
      )
    )
  )`;

const tombSql = `INSERT INTO saved_words (
  user_id, word_key, word, gloss, native_language,
  sentence_en, sentence_native, saved_at, deleted_at,
  book_id, chapter_id, sentence_id, book_source
) VALUES (?, ?, ?, '', ?, '', '', ?, ?, '', '', '', '')
ON CONFLICT(user_id, word_key) DO UPDATE SET
  word = excluded.word,
  gloss = '',
  native_language = excluded.native_language,
  sentence_en = '',
  sentence_native = '',
  saved_at = excluded.deleted_at,
  deleted_at = excluded.deleted_at,
  book_id = '',
  chapter_id = '',
  sentence_id = '',
  book_source = ''
WHERE excluded.deleted_at > CASE
    WHEN saved_words.deleted_at IS NULL THEN saved_words.saved_at
    ELSE saved_words.deleted_at
  END
  OR (
    saved_words.deleted_at IS NULL
    AND excluded.deleted_at = saved_words.saved_at
  )`;

const pruneLiveSql = `DELETE FROM saved_words
WHERE user_id = ? AND deleted_at IS NULL AND word_key NOT IN (
  SELECT word_key FROM saved_words
  WHERE user_id = ? AND deleted_at IS NULL
  ORDER BY saved_at DESC, word ASC
  LIMIT 2000
)`;

const pruneTombSql = `DELETE FROM saved_words
WHERE user_id = ? AND deleted_at IS NOT NULL AND word_key NOT IN (
  SELECT word_key FROM saved_words
  WHERE user_id = ? AND deleted_at IS NOT NULL
  ORDER BY deleted_at DESC, word ASC
  LIMIT 2000
)`;

function wordsResponse(body: unknown, status: number, userId: string): Response {
  if (status !== 200) console.error("words-sync", status, userId);
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}

function isPayload(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  return typeof value === "object" && value !== null && "words" in value;
}

type WordRow = {
  word: string;
  gloss: string;
  native_language: string;
  sentence_en: string;
  sentence_native: string;
  saved_at: number;
  deleted_at: number | null;
  book_id: string | null;
  chapter_id: string | null;
  sentence_id: string | null;
  book_source: string | null;
};

function storeFromRows(rows: readonly WordRow[]): SavedWordStore {
  const words: SavedWord[] = [];
  const tombstones: WordTombstone[] = [];
  for (const row of rows) {
    if (row.native_language !== "uk" && row.native_language !== "ru") continue;
    if (row.deleted_at !== null) {
      tombstones.push({
        word: row.word,
        nativeLanguage: row.native_language,
        deletedAt: row.deleted_at,
      });
      continue;
    }
    words.push({
      word: row.word,
      gloss: row.gloss,
      nativeLanguage: row.native_language,
      savedAt: row.saved_at,
      sentenceEn: row.sentence_en,
      sentenceNative: row.sentence_native,
      bookId: row.book_id ?? "",
      chapterId: row.chapter_id ?? "",
      sentenceId: row.sentence_id ?? "",
      bookSource: row.book_source === "catalog" || row.book_source === "local" ? row.book_source : "",
    });
  }
  return parseSavedWordStore({ words, tombstones });
}

function sameLive(left: SavedWord, right: SavedWord): boolean {
  return (
    left.word === right.word &&
    left.gloss === right.gloss &&
    left.nativeLanguage === right.nativeLanguage &&
    left.savedAt === right.savedAt &&
    left.sentenceEn === right.sentenceEn &&
    left.sentenceNative === right.sentenceNative &&
    left.bookId === right.bookId &&
    left.chapterId === right.chapterId &&
    left.sentenceId === right.sentenceId &&
    left.bookSource === right.bookSource
  );
}

function sameTomb(left: WordTombstone, right: WordTombstone): boolean {
  return (
    left.word === right.word &&
    left.nativeLanguage === right.nativeLanguage &&
    left.deletedAt === right.deletedAt
  );
}

async function readStore(userId: string): Promise<SavedWordStore> {
  const { database } = await import("#/auth/db.server");
  const result = await database()
    .prepare(
      `SELECT word, gloss, native_language, sentence_en, sentence_native, saved_at, deleted_at,
              book_id, chapter_id, sentence_id, book_source
       FROM saved_words WHERE user_id = ?`,
    )
    .bind(userId)
    .all<WordRow>();
  return storeFromRows(result.results);
}

async function writeStore(userId: string, incoming: SavedWordStore): Promise<SavedWordStore> {
  const { database } = await import("#/auth/db.server");
  const db = database();
  const stored = await readStore(userId);
  const merged = mergeWordStores(stored, incoming);
  const storedLive = new Map(
    stored.words.map((word) => [`${word.nativeLanguage}:${word.word}`, word]),
  );
  const storedTomb = new Map(
    stored.tombstones.map((tomb) => [`${tomb.nativeLanguage}:${tomb.word}`, tomb]),
  );
  const statements = [];
  for (const word of merged.words) {
    const key = savedWordKey(word.word, word.nativeLanguage);
    if (key === null) continue;
    const previous = storedLive.get(key);
    if (previous !== undefined && !storedTomb.has(key) && sameLive(previous, word)) continue;
    statements.push(
      db
        .prepare(liveSql)
        .bind(
          userId,
          key,
          word.word,
          word.gloss,
          word.nativeLanguage,
          word.sentenceEn,
          word.sentenceNative,
          word.savedAt,
          word.bookId,
          word.chapterId,
          word.sentenceId,
          word.bookSource,
        ),
    );
  }
  for (const tomb of merged.tombstones) {
    const key = savedWordKey(tomb.word, tomb.nativeLanguage);
    if (key === null) continue;
    const previous = storedTomb.get(key);
    if (previous !== undefined && !storedLive.has(key) && sameTomb(previous, tomb)) continue;
    statements.push(
      db
        .prepare(tombSql)
        .bind(userId, key, tomb.word, tomb.nativeLanguage, tomb.deletedAt, tomb.deletedAt),
    );
  }
  statements.push(db.prepare(pruneLiveSql).bind(userId, userId));
  statements.push(db.prepare(pruneTombSql).bind(userId, userId));
  for (let index = 0; index < statements.length; index += 50) {
    await db.batch(statements.slice(index, index + 50));
  }
  return readStore(userId);
}

async function handle(method: "GET" | "PUT", request: Request): Promise<Response> {
  let userId = "";
  try {
    const { readCurrentUser } = await import("#/auth/session.server");
    const user = await readCurrentUser();
    if (!user) return wordsResponse({ error: "anonymous" }, 401, "");
    userId = user.id;
    if (method === "GET") return wordsResponse(await readStore(userId), 200, userId);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return wordsResponse({ error: "invalid" }, 400, userId);
    }
    const bounded = await readBoundedBody(request);
    if (!bounded.ok) return wordsResponse({ error: "invalid" }, bounded.status, userId);
    const raw = bounded.text;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return wordsResponse({ error: "invalid" }, 400, userId);
    }
    if (!isPayload(parsed)) return wordsResponse({ error: "invalid" }, 400, userId);
    const incoming = clampSavedWordTimes(parseSavedWordStore(parsed), Date.now());
    const stored = await writeStore(userId, incoming);
    return wordsResponse(stored, 200, userId);
  } catch {
    return wordsResponse({ error: "unavailable" }, 500, userId);
  }
}

export const Route = createFileRoute("/api/words")({
  server: {
    handlers: {
      GET: ({ request }) => handle("GET", request),
      PUT: ({ request }) => handle("PUT", request),
    },
  },
});
