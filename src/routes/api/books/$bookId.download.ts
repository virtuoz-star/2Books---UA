import { createFileRoute } from "@tanstack/react-router";

const missHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

function bodyFrom(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return new Blob([copy]);
}

function edgeCache(): Cache | null {
  try {
    const storage = globalThis.caches as (CacheStorage & { default?: Cache }) | undefined;
    return storage?.default ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/books/$bookId/download")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const lang = new URL(request.url).searchParams.get("lang");
        const slot = lang === "uk" || lang === "ru" ? lang : null;
        if (slot === null) return new Response("Not found", { status: 404, headers: missHeaders });
        try {
          const { catalogBookRevision, readPublicCatalogBook } = await import(
            "#/library/books.server"
          );
          const { downloadSlug, writeTwoBooksPrefer } = await import("#/library/two-books-write");
          const revision = await catalogBookRevision(params.bookId);
          if (revision === null) {
            return new Response("Not found", { status: 404, headers: missHeaders });
          }
          const etag = `W/"${params.bookId}-${revision}-${slot}"`;
          const headers = {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
            "Content-Type": "application/octet-stream",
            ETag: etag,
          };
          const match = request.headers.get("if-none-match");
          if (match?.split(",").some((part) => part.trim() === etag)) {
            return new Response(null, { status: 304, headers });
          }
          const cacheKey = new Request(
            new URL(
              `${new URL(request.url).origin}/api/books/${params.bookId}/download?lang=${slot}&rev=${encodeURIComponent(etag)}`,
            ),
            { method: "GET" },
          );
          const cache = edgeCache();
          if (cache) {
            try {
              const hit = await cache.match(cacheKey);
              if (hit) {
                const bytes = new Uint8Array(await hit.arrayBuffer());
                return new Response(bodyFrom(bytes), {
                  headers: {
                    ...headers,
                    "Content-Disposition": hit.headers.get("Content-Disposition") ?? "attachment",
                  },
                });
              }
            } catch {
              // The edge cache is optional. A miss still builds the archive.
            }
          }
          const book = await readPublicCatalogBook(params.bookId);
          if (!book) return new Response("Not found", { status: 404, headers: missHeaders });
          const slug = downloadSlug(book.id);
          const bytes = slug === null ? null : await writeTwoBooksPrefer(book, slot);
          if (bytes === null || slug === null) {
            return new Response("Not found", { status: 404, headers: missHeaders });
          }
          const responseHeaders = {
            ...headers,
            "Content-Disposition": `attachment; filename="${slug}.2books"`,
          };
          const response = new Response(bodyFrom(bytes), { headers: responseHeaders });
          if (cache) {
            try {
              await cache.put(cacheKey, response.clone());
            } catch {
              // Ignore a cache that refuses the body.
            }
          }
          return response;
        } catch {
          return new Response("Unavailable", { status: 500, headers: missHeaders });
        }
      },
    },
  },
});
