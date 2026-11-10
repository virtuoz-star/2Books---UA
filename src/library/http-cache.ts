export const publicCatalogHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
} as const;

export function catalogResponse(request: Request, body: unknown, etag: string): Response {
  const headers = { ...publicCatalogHeaders, ETag: etag };
  const match = request.headers.get("if-none-match");
  if (match?.split(",").some((part) => part.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }
  return Response.json(body, { headers });
}
