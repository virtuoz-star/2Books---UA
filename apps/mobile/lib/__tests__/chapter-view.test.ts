import { expect, test } from "bun:test";

import { chapterView } from "../chapter-view";
import type { BookDetail } from "../types";

function sentence(id: string) {
  return { id, en: "Gate.", uk: "Брама.", ru: "", paragraph: 0 };
}

test("the open chapter keeps its sentences and the source book stays intact", () => {
  const book: BookDetail = {
    id: "red-boat",
    author: "A. Writer",
    title: { uk: "Червоний", ru: "Красный", en: "Red" },
    chapters: [0, 1, 2].map((index) => ({
      id: `c${index + 1}`,
      title: { uk: "Частина", ru: "Часть", en: `Part ${index + 1}` },
      sentences: [sentence(`s${index + 1}`)],
    })),
  };
  const view = chapterView(book, 1);
  expect(view).not.toBe(book);
  expect(view.chapters[0]?.sentences).toEqual([]);
  expect(view.chapters[1]?.sentences).toEqual(book.chapters[1]?.sentences);
  expect(view.chapters[2]?.sentences).toEqual([]);
  expect(book.chapters[0]?.sentences).toHaveLength(1);
  expect(book.chapters[1]?.sentences).toHaveLength(1);
  expect(book.chapters[2]?.sentences).toHaveLength(1);
});
