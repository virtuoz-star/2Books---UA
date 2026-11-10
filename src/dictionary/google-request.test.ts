import { afterEach, expect, test } from "vite-plus/test";

import { postGoogleTranslate } from "./google-request";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetch still runs when AbortSignal.any and AbortSignal.timeout are missing", async () => {
  const saved = {
    any: Object.getOwnPropertyDescriptor(AbortSignal, "any"),
    timeout: Object.getOwnPropertyDescriptor(AbortSignal, "timeout"),
  };
  Object.defineProperty(AbortSignal, "any", { configurable: true, writable: true, value: undefined });
  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    writable: true,
    value: undefined,
  });
  const calls: Array<RequestInit | undefined> = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init);
    return new Response(
      JSON.stringify({ data: { translations: [{ translatedText: "так" }] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const result = await postGoogleTranslate({
      key: "test-key",
      q: ["yes"],
      target: "uk",
      signal: new AbortController().signal,
      timeoutMs: 5_000,
    });
    expect(result).toEqual({ ok: true, rows: [{ text: "так" }] });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  } finally {
    if (saved.any) Object.defineProperty(AbortSignal, "any", saved.any);
    if (saved.timeout) Object.defineProperty(AbortSignal, "timeout", saved.timeout);
  }
});
