import { createFileRoute } from "@tanstack/react-router";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export const Route = createFileRoute("/api/session/ready")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { googleAuthConfigured } = await import("#/auth/auth.server");
          return Response.json({ google: googleAuthConfigured() }, { headers });
        } catch {
          return Response.json({ google: false }, { headers });
        }
      },
    },
  },
});
