import { expect, test } from "vite-plus/test";

import type { Book } from "#/content/catalog";
import { chapterView } from "#/library/chapter-view";

const book: Book = {
  id: "sample",
  author: "A. Writer",
  title: { uk: "Зразок", ru: "Образец", en: "Sample" },
  chapters: [
    {
      id: "c1",
      title: { uk: "Перша", ru: "Первая", en: "First" },
      sentences: [{ id: "s1", en: "Hello.", uk: "Привіт.", ru: "Привет.", paragraph: 0 }],
    },
    {
      id: "c2",
      title: { uk: "Друга", ru: "Вторая", en: "Second" },
      sentences: [{ id: "s2", en: "Next.", uk: "Далі.", ru: "Дальше.", paragraph: 1 }],
    },
  ],
};

test("chapter view keeps one chapter and the other titles", () => {
  const view = chapterView(book, "c1");
  expect(view?.chapters[0]?.sentences).toEqual(book.chapters[0]?.sentences);
  expect(view?.chapters[1]?.sentences).toEqual([]);
  expect(view?.chapters[1]?.title.en).toBe("Second");
  expect(book.chapters[1]?.sentences).toHaveLength(1);
});

test("chapter view rejects an unknown part", () => {
  expect(chapterView(book, "c9")).toBeNull();
});
