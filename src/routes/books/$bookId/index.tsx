import { createFileRoute, isNotFound, isRedirect, redirect } from "@tanstack/react-router";

import { loadLibraryHome } from "#/library/api";

export const Route = createFileRoute("/books/$bookId/")({
  beforeLoad: async ({ params }) => {
    let chapterId = "c1";
    try {
      const home = await loadLibraryHome();
      const progress = home.progress;
      if (progress !== null && progress.bookId === params.bookId && progress.chapterId !== "") {
        chapterId = progress.chapterId;
      }
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
