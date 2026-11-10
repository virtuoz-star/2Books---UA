import { createFileRoute, isNotFound, isRedirect, redirect } from "@tanstack/react-router";

import { loadBookProgress } from "#/library/api";
import { loadBrowserProgress, preferProgress } from "#/reader/progress";

export const Route = createFileRoute("/books/$bookId/")({
  staleTime: 0,
  beforeLoad: async ({ params }) => {
    let chapterId = "c1";
    try {
      const remote = await loadBookProgress({ data: { bookId: params.bookId } });
      const local = typeof window === "undefined" ? null : loadBrowserProgress(params.bookId);
      const progress = preferProgress(local, remote);
      if (progress !== null && progress.chapterId !== "") chapterId = progress.chapterId;
    } catch (error) {
      if (isRedirect(error) || isNotFound(error)) throw error;
      chapterId = "c1";
    }
    throw redirect({
      to: "/books/$bookId/$chapterId",
      params: { bookId: params.bookId, chapterId },
    });
  },
});
