import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

export const Route = createFileRoute("/api/books/$bookId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { readPublicCatalogBook } = await import("#/library/books.server");
          const book = await readPublicCatalogBook(params.bookId);
          if (!book) {
            return new Response("Not found", { status: 404, headers: corsHeaders });
          }
          return Response.json(book, { headers: corsHeaders });
        } catch {
          return new Response("Unavailable", { status: 500, headers: corsHeaders });
        }
      },
    },
  },
});
