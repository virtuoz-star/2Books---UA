import { expect, test } from "vite-plus/test";

import { splitEnglishSentences } from "#/library/split";

test("splits two sentences on a period", () => {
  expect(splitEnglishSentences("One dollar and eighty-seven cents. That was all.")).toEqual([
    "One dollar and eighty-seven cents.",
    "That was all.",
  ]);
});

test("does not split $1.87 or Mr.", () => {
  expect(splitEnglishSentences("She had $1.87 left. Mr. Jameson waited.")).toEqual([
    "She had $1.87 left.",
    "Mr. Jameson waited.",
  ]);
});

test("does not split Mrs. or a single initial", () => {
  expect(splitEnglishSentences("Mrs. D. Smith smiled.")).toEqual(["Mrs. D. Smith smiled."]);
});

test("keeps the question mark on Will you buy my hair?", () => {
  expect(splitEnglishSentences("Will you buy my hair?")).toEqual(["Will you buy my hair?"]);
  expect(splitEnglishSentences("Will you buy my hair? That was all.")).toEqual([
    "Will you buy my hair?",
    "That was all.",
  ]);
});

test("collapses whitespace and drops empty pieces", () => {
  expect(splitEnglishSentences("  One   dollar.\r\n\r\nThat   was all.  ")).toEqual([
    "One dollar.",
    "That was all.",
  ]);
});
