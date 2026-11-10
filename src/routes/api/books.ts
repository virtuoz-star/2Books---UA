import { createFileRoute } from "@tanstack/react-router";

import { catalogResponse } from "#/library/http-cache";

export const Route = createFileRoute("/api/books")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { listCatalogSummaries } = await import("#/library/books.server");
          const listed = await listCatalogSummaries();
          const etag = `W/"catalog-${listed.revision}"`;
          if (listed.stale) {
            return Response.json(listed.books, {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
                ETag: etag,
              },
            });
          }
          return catalogResponse(request, listed.books, etag);
        } catch {
          return Response.json(
            { error: "unavailable" },
            {
              status: 500,
              headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
            },
          );
        }
      },
    },
  },
});
