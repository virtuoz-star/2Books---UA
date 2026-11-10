import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import type { CurrentUser } from "#/auth/session";
import type { Book, BookSummary, TranslationCode } from "#/content/catalog";
import { applyUploadTranslations } from "#/library/upload-translation";
import { prepareUpload } from "#/library/upload-input";

export type MyBookSummary = {
  id: string;
  title: string;
  author: string;
  alignment: "pending" | "ready";
  alignmentPending: boolean;
  chapterCount: number;
  sentenceCount: number;
  createdAt: number;
  languages: TranslationCode[];
};

export type ReadingProgress = {
  bookId: string;
  chapterId: string;
  sentenceId: string | null;
  updatedAt: number;
};

export type ReaderChapterResult =
  | {
      status: "ok";
      book: Book;
      progress: ReadingProgress | null;
      upload: { alignment: "pending" | "ready" } | null;
    }
  | { status: "missing" }
  | { status: "unavailable" };

function privateNoStore(): void {
  try {
    setResponseHeader("Cache-Control", "private, no-store");
    setResponseHeader("Vary", "Cookie");
  } catch {
    // A missing response context must not block the library read.
  }
}

function assertId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) {
    throw new Error("invalid progress");
  }
  return value;
}

function assertBookId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) {
    throw new Error("invalid book");
  }
  return value;
}

function isChapterId(value: string): boolean {
  return value.length >= 2 && value.length <= 12 && /^c\d+$/.test(value);
}

export const loadReaderChapter = createServerFn({ method: "GET" })
  .validator((input: { bookId?: unknown; chapterId?: unknown }) => ({
    bookId: typeof input?.bookId === "string" ? input.bookId : "",
    chapterId: typeof input?.chapterId === "string" ? input.chapterId : "",
  }))
  .handler(async ({ data }): Promise<ReaderChapterResult> => {
    privateNoStore();
    if (
      data.bookId.length < 1 ||
      data.bookId.length > 80 ||
      !isChapterId(data.chapterId)
    ) {
      return { status: "missing" };
    }
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      let userId: string | null = null;
      try {
        userId = (await readCurrentUser())?.id ?? null;
      } catch {
        userId = null;
      }
      const { readBookProgress, readOwnedUpload, readReaderChapter } = await import(
        "#/library/books.server"
      );
      const book = await readReaderChapter(data.bookId, data.chapterId, async () => userId);
      if (!book) return { status: "missing" };
      let progress: ReadingProgress | null = null;
      let upload: { alignment: "pending" | "ready" } | null = null;
      if (userId !== null) {
        try {
          progress = await readBookProgress(userId, data.bookId);
        } catch {
          progress = null;
        }
        try {
          const owned = await readOwnedUpload(userId, data.bookId);
          if (owned) upload = { alignment: owned.alignment };
        } catch {
          upload = null;
        }
      }
      return { status: "ok", book, progress, upload };
    } catch {
      return { status: "unavailable" };
    }
  });

export const loadBookProgress = createServerFn({ method: "GET" })
  .validator((input: { bookId: string }) => ({ bookId: assertBookId(input.bookId) }))
  .handler(async ({ data }): Promise<ReadingProgress | null> => {
    privateNoStore();
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      const user = await readCurrentUser();
      if (!user) return null;
      const { readBookProgress } = await import("#/library/books.server");
      return await readBookProgress(user.id, data.bookId);
    } catch {
      return null;
    }
  });

async function publicCatalog(): Promise<{ books: BookSummary[]; degraded: boolean }> {
  try {
    const { listCatalogSummaries } = await import("#/library/books.server");
    const listed = await listCatalogSummaries();
    return { books: listed.books, degraded: listed.stale };
  } catch {
    const { bookSummary, catalogBooks } = await import("#/content/catalog");
    return { books: catalogBooks.map((book) => bookSummary(book)), degraded: true };
  }
}

export const loadLibraryHome = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    user: CurrentUser | null;
    catalog: BookSummary[];
    myBooks: MyBookSummary[];
    progress: ReadingProgress | null;
    progressByBook: ReadingProgress[];
    /** True when the catalog or the signed-in shelf could not be loaded. An empty shelf alone is not this. */
    degraded: boolean;
  }> => {
    privateNoStore();
    const loaded = await publicCatalog();
    const catalog = loaded.books;
    let degraded = loaded.degraded;
    let user: CurrentUser | null = null;
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      user = await readCurrentUser();
    } catch {
      return {
        user: null,
        catalog,
        myBooks: [],
        progress: null,
        progressByBook: [],
        degraded: true,
      };
    }
    if (!user) {
      return { user: null, catalog, myBooks: [], progress: null, progressByBook: [], degraded };
    }
    try {
      const { listMyBooks, listUserProgress } = await import("#/library/books.server");
      const [myBooks, progressByBook] = await Promise.all([
        listMyBooks(user.id),
        listUserProgress(user.id),
      ]);
      return {
        user,
        catalog,
        myBooks,
        progress: progressByBook[0] ?? null,
        progressByBook,
        degraded,
      };
    } catch {
      return { user, catalog, myBooks: [], progress: null, progressByBook: [], degraded: true };
    }
  },
);

export const saveProgress = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; chapterId: string; sentenceId: string | null }) => {
    const sentenceId = input?.sentenceId;
    if (
      sentenceId !== null &&
      (typeof sentenceId !== "string" || sentenceId.length < 1 || sentenceId.length > 80)
    ) {
      throw new Error("invalid progress");
    }
    return {
      bookId: assertId(input?.bookId),
      chapterId: assertId(input?.chapterId),
      sentenceId,
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: true } | { ok: false; error: "anonymous" | "unavailable" }> => {
      privateNoStore();
      try {
        const { readCurrentUser } = await import("#/auth/session.server");
        const user = await readCurrentUser();
        if (!user) return { ok: false, error: "anonymous" };
        const { saveReadingProgress } = await import("#/library/books.server");
        const outcome = await saveReadingProgress(user.id, data);
        if (outcome === "refused") return { ok: false, error: "unavailable" };
        return { ok: true };
      } catch {
        return { ok: false, error: "unavailable" };
      }
    },
  );

export type UploadSentence = { id: string; en: string; uk: string; ru: string };

export type UploadTranslationState = { alignment: "pending" | "ready" };

export type SaveUploadResult =
  | { ok: true; alignment: "pending" | "ready"; filled: number; remaining: number }
  | {
      ok: false;
      error: "anonymous" | "not-found" | "not-pending" | "invalid" | "unavailable" | "too-large";
    };

function assertUploadBookId(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) {
    throw new Error("invalid book");
  }
  return value;
}

export const loadUploadSentences = createServerFn({ method: "GET" })
  .validator((input: { bookId: string }) => ({ bookId: assertUploadBookId(input?.bookId) }))
  .handler(
    async ({
      data,
    }): Promise<{ alignment: "pending" | "ready"; sentences: UploadSentence[] } | null> => {
      privateNoStore();
      try {
        const { readCurrentUser } = await import("#/auth/session.server");
        const user = await readCurrentUser();
        if (!user) return null;
        const { readOwnedUpload } = await import("#/library/books.server");
        const row = await readOwnedUpload(user.id, data.bookId);
        if (!row) return null;
        return { alignment: row.alignment, sentences: row.sentences };
      } catch {
        return null;
      }
    },
  );

export const uploadTranslationState = createServerFn({ method: "GET" })
  .validator((input: { bookId: string }) => ({ bookId: assertUploadBookId(input?.bookId) }))
  .handler(async ({ data }): Promise<UploadTranslationState | null> => {
    privateNoStore();
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      const user = await readCurrentUser();
      if (!user) return null;
      const { readOwnedUpload } = await import("#/library/books.server");
      const row = await readOwnedUpload(user.id, data.bookId);
      if (!row) return null;
      return { alignment: row.alignment };
    } catch {
      return null;
    }
  });

export const saveUploadTranslations = createServerFn({ method: "POST" })
  .validator(
    (input: {
      bookId: string;
      again: boolean;
      sentences: { id: string; uk: string; ru: string }[];
    }) => {
      if (
        typeof input?.again !== "boolean" ||
        !Array.isArray(input.sentences) ||
        input.sentences.length > 200
      ) {
        throw new Error("invalid");
      }
      return {
        bookId: assertUploadBookId(input.bookId),
        again: input.again,
        sentences: input.sentences,
      };
    },
  )
  .handler(async ({ data }): Promise<SaveUploadResult> => {
    privateNoStore();
    let userId = "";
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      const user = await readCurrentUser();
      if (!user) return { ok: false, error: "anonymous" };
      userId = user.id;
      const { readOwnedUpload, updateOwnedUpload } = await import("#/library/books.server");
      const row = await readOwnedUpload(userId, data.bookId);
      if (!row) return { ok: false, error: "not-found" };
      if (!data.again && row.alignment === "ready") return { ok: false, error: "not-pending" };
      const applied = applyUploadTranslations(row.body, {
        again: data.again,
        sentences: data.sentences,
      });
      if (!applied.ok) return { ok: false, error: "invalid" };
      if (applied.body !== row.body) {
        const saved = await updateOwnedUpload(
          userId,
          data.bookId,
          row.bodyJson,
          JSON.stringify(applied.body),
          applied.alignment,
        );
        if (saved.status === "too-large") return { ok: false, error: "too-large" };
        if (saved.changes === 0) return { ok: false, error: "unavailable" };
      }
      return {
        ok: true,
        alignment: applied.alignment,
        filled: applied.filled,
        remaining: applied.remaining,
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "Error";
      console.error("upload-translate", userId, data.bookId, errorName);
      return { ok: false, error: "unavailable" };
    }
  });

export const uploadText = createServerFn({ method: "POST" })
  .validator((input: { title: string; text: string }) => {
    if (typeof input?.title !== "string" || typeof input?.text !== "string") {
      throw new Error("invalid input");
    }
    return { title: input.title, text: input.text };
  })
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; bookId: string }
      | { ok: false; error: "anonymous" | "invalid-input" | "too-long" | "quota" | "rate" | "unavailable" }
    > => {
      privateNoStore();
      try {
        const { readCurrentUser } = await import("#/auth/session.server");
        const user = await readCurrentUser();
        if (!user) return { ok: false, error: "anonymous" };
        const prepared = prepareUpload(data.title, data.text);
        if (!prepared.ok) return prepared;
        const { insertUserBook } = await import("#/library/books.server");
        const bookId = await insertUserBook(user.id, prepared.title, prepared.sentences);
        return { ok: true, bookId };
      } catch (error) {
        if (error instanceof Error && error.name === "UploadQuotaError") {
          return { ok: false, error: "quota" };
        }
        if (error instanceof Error && error.name === "UploadRateError") {
          return { ok: false, error: "rate" };
        }
        return { ok: false, error: "unavailable" };
      }
    },
  );

export const renameMyBook = createServerFn({ method: "POST" })
  .validator((input: { bookId: string; title: string }) => {
    if (typeof input?.title !== "string") throw new Error("invalid");
    return { bookId: assertUploadBookId(input?.bookId), title: input.title };
  })
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true } | { ok: false; error: "anonymous" | "not-found" | "invalid" | "unavailable" }
    > => {
      privateNoStore();
      try {
        const { readCurrentUser } = await import("#/auth/session.server");
        const user = await readCurrentUser();
        if (!user) return { ok: false, error: "anonymous" };
        const { renameOwnedBook } = await import("#/library/books.server");
        const outcome = await renameOwnedBook(user.id, data.bookId, data.title);
        if (outcome === "missing") return { ok: false, error: "not-found" };
        if (outcome === "invalid") return { ok: false, error: "invalid" };
        return { ok: true };
      } catch {
        return { ok: false, error: "unavailable" };
      }
    },
  );

export const deleteMyBook = createServerFn({ method: "POST" })
  .validator((input: { bookId: string }) => ({ bookId: assertUploadBookId(input?.bookId) }))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true } | { ok: false; error: "anonymous" | "not-found" | "unavailable" }> => {
      privateNoStore();
      try {
        const { readCurrentUser } = await import("#/auth/session.server");
        const user = await readCurrentUser();
        if (!user) return { ok: false, error: "anonymous" };
        const { deleteOwnedBook } = await import("#/library/books.server");
        const outcome = await deleteOwnedBook(user.id, data.bookId);
        if (outcome === "missing") return { ok: false, error: "not-found" };
        return { ok: true };
      } catch {
        return { ok: false, error: "unavailable" };
      }
    },
  );
