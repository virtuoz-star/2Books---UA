import { expect, test } from "bun:test";

import { scrollOffsetForSentence, sentenceRows, visibleSentence } from "../sentence-place";

test("sentences that share no paragraph metadata are still separate rows", () => {
  const rows = sentenceRows([{ id: "a" }, { id: "b" }, { id: "c" }]);
  expect(rows.map((row) => row.sentence.id)).toEqual(["a", "b", "c"]);
  expect(rows.every((row) => row.paragraphEnd === false)).toBe(true);
});

test("a paragraph change is the only wide gap", () => {
  const rows = sentenceRows([
    { id: "a", paragraph: 0 },
    { id: "b", paragraph: 0 },
    { id: "c", paragraph: 1 },
  ]);
  expect(rows.map((row) => row.paragraphEnd)).toEqual([false, true, false]);
});

test("the visible sentence is the row under the viewport, not the first of a paragraph", () => {
  expect(
    visibleSentence(120, 0, [
      { id: "a", index: 0, height: 100 },
      { id: "b", index: 1, height: 80 },
    ]),
  ).toEqual({ sentenceId: "b", sentenceIndex: 1 });
  expect(
    visibleSentence(0, 0, [
      { id: "a", index: 0, height: 100 },
      { id: "b", index: 1, height: 80 },
    ]),
  ).toEqual({ sentenceId: "a", sentenceIndex: 0 });
});

test("scroll waits until every row above the sentence has a height", () => {
  expect(scrollOffsetForSentence(10, [20, 0], 2)).toBeNull();
  expect(scrollOffsetForSentence(10, [20, 40], 2)).toBe(62);
});
