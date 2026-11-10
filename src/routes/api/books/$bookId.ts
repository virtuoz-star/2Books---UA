import { createFileRoute } from "@tanstack/react-router";

import { catalogResponse } from "#/library/http-cache";

const missHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export const Route = createFileRoute("/api/books/$bookId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const { catalogBookRevision, readPublicCatalogBook, readPublicCatalogChapter } =
            await import("#/library/books.server");
          const revision = await catalogBookRevision(params.bookId);
          if (revision === null) {
            return new Response("Not found", { status: 404, headers: missHeaders });
          }
          const chapter = new URL(request.url).searchParams.get("chapter");
          if (chapter !== null) {
            if (!/^c\d+$/.test(chapter) || chapter.length > 12) {
              return new Response("Not found", { status: 404, headers: missHeaders });
            }
            const etag = `W/"${params.bookId}-${revision}-${chapter}"`;
            const match = request.headers.get("if-none-match");
            if (match?.split(",").some((part) => part.trim() === etag)) {
              return catalogResponse(request, null, etag);
            }
            const part = await readPublicCatalogChapter(params.bookId, chapter);
            if (!part) return new Response("Not found", { status: 404, headers: missHeaders });
            return catalogResponse(request, part, etag);
          }
          const etag = `W/"${params.bookId}-${revision}"`;
          const match = request.headers.get("if-none-match");
          if (match?.split(",").some((part) => part.trim() === etag)) {
            return catalogResponse(request, null, etag);
          }
          const book = await readPublicCatalogBook(params.bookId);
          if (!book) return new Response("Not found", { status: 404, headers: missHeaders });
          return catalogResponse(request, book, etag);
        } catch {
          return new Response("Unavailable", { status: 500, headers: missHeaders });
        }
      },
    },
  },
});
