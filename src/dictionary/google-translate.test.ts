import { expect, test } from "vite-plus/test";

import {
  decodeTranslateText,
  googleTranslateEndpoint,
  maxGoogleKeyLength,
  packTranslateBatches,
  readTranslations,
  translateRequestByteLimit,
  translateRequestCharLimit,
  translateRequestStringLimit,
} from "#/dictionary/google-translate";

test("the translate endpoint is Google's v2 host and keeps only the key", () => {
  const url = googleTranslateEndpoint(" test-key ");
  expect(url.origin).toBe("https://translation.googleapis.com");
  expect(url.pathname).toBe("/language/translate/v2");
  expect(url.searchParams.get("key")).toBe("test-key");
  expect([...url.searchParams.keys()]).toEqual(["key"]);
  expect(url.hostname.includes("2books")).toBe(false);
  expect(() => googleTranslateEndpoint("")).toThrow();
  expect(() => googleTranslateEndpoint("k".repeat(maxGoogleKeyLength + 1))).toThrow();
});

test("translate batches honor the string, character, and byte limits", () => {
  expect(translateRequestCharLimit).toBe(4_500);
  expect(translateRequestStringLimit).toBe(128);
  expect(translateRequestByteLimit).toBe(90_000);
  expect(packTranslateBatches([])).toEqual({ batches: [], unpackable: [] });
  const huge = "a".repeat(translateRequestCharLimit + 1);
  expect(packTranslateBatches(["ok", huge, "next"])).toEqual({
    batches: [{ indexes: [0] }, { indexes: [2] }],
    unpackable: [1],
  });
  const many = Array.from({ length: translateRequestStringLimit + 1 }, () => "a");
  const packed = packTranslateBatches(many);
  expect(packed.unpackable).toEqual([]);
  expect(packed.batches[0]?.indexes).toHaveLength(translateRequestStringLimit);
  expect(packed.batches[1]?.indexes).toEqual([translateRequestStringLimit]);
});

test("entity decode runs once and a wrong-length body is rejected", () => {
  expect(decodeTranslateText("&amp;lt;")).toBe("&lt;");
  expect(
    readTranslations(
      { data: { translations: [{ translatedText: "пенні" }, { translatedText: "x" }] } },
      1,
    ),
  ).toBeNull();
  expect(readTranslations({ data: { translations: [{ translatedText: "  " }] } }, 1)).toEqual([
    { text: null },
  ]);
});
