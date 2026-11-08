import { env } from "cloudflare:workers";

export function database(): D1Database {
  const bound = env.DB;
  if (!bound) throw new Error("unavailable");
  return bound;
}
