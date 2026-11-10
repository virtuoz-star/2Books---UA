import { expect, test } from "vite-plus/test";

import { catalogResponse } from "#/library/http-cache";

test("catalog response caches and answers 304 for the same etag", async () => {
  const request = new Request("http://localhost/api/books", {
    headers: { "if-none-match": 'W/"catalog-1"' },
  });
  const cached = catalogResponse(request, { ok: true }, 'W/"catalog-1"');
  expect(cached.status).toBe(304);
  expect(cached.headers.get("Cache-Control")).toContain("public");
  expect(await cached.text()).toBe("");

  const fresh = catalogResponse(
    new Request("http://localhost/api/books"),
    ["book"],
    'W/"catalog-2"',
  );
  expect(fresh.status).toBe(200);
  expect(await fresh.json()).toEqual(["book"]);
});
