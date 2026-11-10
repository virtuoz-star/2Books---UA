import { expect, test } from "bun:test";

import { message } from "../messages";
import { nativeLine, storedSentenceNative } from "../native-line";

test("an empty native field falls back without changing the sentence", () => {
  const sentence = { uk: "", ru: "Там" };
  expect(nativeLine(sentence, "uk", "en")).toBe("Там");
  expect(sentence).toEqual({ uk: "", ru: "Там" });
});

test("both empty native fields use the interface message", () => {
  expect(nativeLine({ uk: "", ru: "" }, "ru", "en")).toBe(message("en", "noTranslation"));
});

test("a saved sentence keeps an empty translation instead of the placeholder", () => {
  expect(storedSentenceNative({ uk: "", ru: "" }, "uk")).toBe("");
  expect(storedSentenceNative({ uk: "", ru: "Там" }, "uk")).toBe("");
  expect(storedSentenceNative({ uk: "Там", ru: "" }, "uk")).toBe("Там");
});
