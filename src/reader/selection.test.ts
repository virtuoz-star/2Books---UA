import { expect, test } from "vite-plus/test";

import { clearSelection, selectSentence, selectWord } from "#/reader/selection";

test("none → s5", () => {
  expect(selectSentence({ selectedId: null }, "s5")).toEqual({ selectedId: "s5" });
});

test("s5 again → null", () => {
  const open = selectSentence({ selectedId: null }, "s5");
  expect(selectSentence(open, "s5")).toEqual({ selectedId: null });
});

test("s1 then s7 → only s7", () => {
  const afterS1 = selectSentence({ selectedId: null }, "s1");
  expect(afterS1).toEqual({ selectedId: "s1" });
  expect(selectSentence(afterS1, "s7")).toEqual({ selectedId: "s7" });
});

test("clear → null", () => {
  expect(clearSelection()).toEqual({ selectedId: null });
});

test("selectWord stores the sentence and the index", () => {
  expect(selectWord({ selectedId: null }, "s5", 2)).toEqual({
    selectedId: "s5",
    wordIndex: 2,
  });
});

test("selectWord on the same word clears the index and keeps the sentence", () => {
  const open = selectWord({ selectedId: null }, "s5", 2);
  expect(selectWord(open, "s5", 2)).toEqual({ selectedId: "s5", wordIndex: null });
});

test("selecting another sentence clears the word", () => {
  const open = selectWord({ selectedId: null }, "s5", 2);
  expect(selectSentence(open, "s7")).toEqual({ selectedId: "s7" });
});

test("clearSelection clears the sentence and the word", () => {
  const open = selectWord({ selectedId: null }, "s5", 2);
  expect(open.wordIndex).toBe(2);
  expect(clearSelection()).toEqual({ selectedId: null });
});
