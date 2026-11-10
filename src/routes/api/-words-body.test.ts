import { expect, test } from "vite-plus/test";

import { readBoundedBody } from "./words";

function streamed(chunks: Uint8Array[], headers: Record<string, string>): Request {
  const pending = [...chunks];
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = pending.shift();
      if (!next) {
        controller.close();
        return;
      }
      controller.enqueue(next);
    },
  });
  return new Request("http://localhost/api/words", {
    method: "PUT",
    body: stream,
    duplex: "half",
    headers,
  } as RequestInit);
}

/** A Request whose body getter counts reads. The constructor does not pull a stream. */
function unread(headers: Record<string, string>): { request: Request; reads: () => number } {
  const request = new Request("http://localhost/api/words", { method: "PUT", headers });
  let reads = 0;
  Object.defineProperty(request, "body", {
    configurable: true,
    get() {
      reads += 1;
      return new ReadableStream<Uint8Array>({
        pull() {
          throw new Error("should not read");
        },
      });
    },
  });
  return { request, reads: () => reads };
}

test("a missing content-length is rejected before the body is read", async () => {
  const { request, reads } = unread({ "content-type": "application/json" });
  expect(await readBoundedBody(request, 8)).toEqual({ ok: false, status: 411 });
  expect(reads()).toBe(0);
});

test("a declared body over the limit is rejected before it is read", async () => {
  const { request, reads } = unread({
    "content-type": "application/json",
    "content-length": "100",
  });
  expect(await readBoundedBody(request, 8)).toEqual({ ok: false, status: 413 });
  expect(reads()).toBe(0);
});

test("a chunked body is rejected as soon as the running total passes the limit", async () => {
  const request = streamed([Uint8Array.from([1, 2, 3, 4]), Uint8Array.from([5, 6, 7, 8, 9])], {
    "content-type": "application/json",
    "content-length": "9",
  });
  expect(await readBoundedBody(request, 8)).toEqual({ ok: false, status: 413 });
});

test("a body under the limit is decoded once", async () => {
  const request = streamed([new TextEncoder().encode('{"a":'), new TextEncoder().encode("1}")], {
    "content-type": "application/json",
    "content-length": "7",
  });
  expect(await readBoundedBody(request, 20)).toEqual({ ok: true, text: '{"a":1}' });
});
