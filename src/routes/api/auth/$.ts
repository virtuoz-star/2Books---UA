import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request): Promise<Response> {
  try {
    const { getAuth } = await import("#/auth/auth.server");
    return await getAuth(request).handler(request);
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
