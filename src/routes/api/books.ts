import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

export const Route = createFileRoute("/api/books")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { listCatalogSummaries } = await import("#/library/books.server");
          return Response.json(await listCatalogSummaries(), { headers: corsHeaders });
        } catch {
          return Response.json({ error: "unavailable" }, { status: 500, headers: corsHeaders });
        }
      },
    },
  },
});
