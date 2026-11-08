import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import type { CurrentUser } from "#/auth/session";
import { prepareUpload } from "#/library/upload-input";

export type MyBookSummary = {
  id: string;
  title: string;
  author: string;
  alignment: "pending" | "ready";
  alignmentPending: boolean;
};

export type ReadingProgress = {
  bookId: string;
  chapterId: string;
  sentenceId: string | null;
};

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

export const loadReaderBook = createServerFn({ method: "GET" })
  .validator((input: { bookId: string }) => {
    if (typeof input.bookId !== "string" || input.bookId.length < 1 || input.bookId.length > 80) {
      throw new Error("invalid book");
    }
    return input;
  })
  .handler(async ({ data }) => {
    privateNoStore();
    let userId: string | null = null;
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      userId = (await readCurrentUser())?.id ?? null;
    } catch {
      userId = null;
    }
    try {
      const { readReaderBook } = await import("#/library/books.server");
      return await readReaderBook(data.bookId, userId);
    } catch {
      return null;
    }
  });

export const loadLibraryHome = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    user: CurrentUser | null;
    myBooks: MyBookSummary[];
    progress: ReadingProgress | null;
  }> => {
    privateNoStore();
    let user: CurrentUser | null = null;
    try {
      const { readCurrentUser } = await import("#/auth/session.server");
      user = await readCurrentUser();
    } catch {
      return { user: null, myBooks: [], progress: null };
    }
    if (!user) return { user: null, myBooks: [], progress: null };
    try {
      const { latestProgress, listMyBooks } = await import("#/library/books.server");
      const [myBooks, progress] = await Promise.all([
        listMyBooks(user.id),
        latestProgress(user.id),
      ]);
      return { user, myBooks, progress };
    } catch {
      return { user, myBooks: [], progress: null };
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
      | { ok: false; error: "anonymous" | "invalid-input" | "too-long" | "unavailable" }
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
      } catch {
        return { ok: false, error: "unavailable" };
      }
    },
  );
