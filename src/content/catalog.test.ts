import { expect, test } from "vite-plus/test";

import { bookSummary, catalogBooks, getCatalogBook } from "#/content/catalog";
import { giftOfTheMagiOpening } from "#/content/gift-of-the-magi";

test("getCatalogBook returns the gift of the magi or null", () => {
  expect(getCatalogBook("missing-book")).toBe(null);
  const book = getCatalogBook("gift-of-the-magi");
  expect(book).toBe(catalogBooks[0]);
  expect(catalogBooks).toHaveLength(1);
  expect(book?.id).toBe("gift-of-the-magi");
  expect(book?.author).toBe("O. Henry");
  expect(book?.title).toEqual({
    en: "The Gift of the Magi",
    uk: "Дари волхвів",
    ru: "Дары волхвов",
  });
  if (book !== null) {
    expect(bookSummary(book)).toEqual({
      id: "gift-of-the-magi",
      author: "O. Henry",
      title: book.title,
      chapterCount: 5,
    });
  }
});

test("five chapter ids c1–c5", () => {
  const book = getCatalogBook("gift-of-the-magi");
  expect(book?.chapters.map((chapter) => chapter.id)).toEqual(["c1", "c2", "c3", "c4", "c5"]);
});

test("chapter c1 starts with the opening sentences", () => {
  const book = getCatalogBook("gift-of-the-magi");
  const opening = giftOfTheMagiOpening.sentences;
  const head = book?.chapters[0]?.sentences.slice(0, 7) ?? [];
  expect(head.map((sentence) => sentence.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
  expect(head.map((sentence) => sentence.en)).toEqual(opening.map((sentence) => sentence.en));
  expect(head[4]?.uk).toBe("Делла перелічила їх тричі.");
  expect(head[4]?.ru).toBe("Делла пересчитала их трижды.");
  expect(head[4]?.uk).toBe(opening[4]?.uk);
  expect(head[4]?.ru).toBe(opening[4]?.ru);
  for (let index = 0; index < opening.length; index += 1) {
    expect(head[index]).toBe(opening[index]);
  }
});

test("sentence ids are unique and in order", () => {
  const book = getCatalogBook("gift-of-the-magi");
  const ids =
    book?.chapters.flatMap((chapter) => chapter.sentences.map((sentence) => sentence.id)) ?? [];
  expect(ids).toEqual(ids.map((_, index) => `s${index + 1}`));
});

test("the last sentence is the magi", () => {
  const book = getCatalogBook("gift-of-the-magi");
  const sentences = book?.chapters.flatMap((chapter) => chapter.sentences) ?? [];
  expect(sentences[sentences.length - 1]?.en).toBe("They are the magi.");
});

test("no sentence has an empty translation", () => {
  const book = getCatalogBook("gift-of-the-magi");
  const sentences = book?.chapters.flatMap((chapter) => chapter.sentences) ?? [];
  expect(sentences.length > 0).toBe(true);
  for (const sentence of sentences) {
    expect(sentence.uk.length > 0).toBe(true);
    expect(sentence.ru.length > 0).toBe(true);
  }
});

test("the book contains Della’s question and Jim’s combs sentence", () => {
  const book = getCatalogBook("gift-of-the-magi");
  const english =
    book?.chapters.flatMap((chapter) => chapter.sentences.map((sentence) => sentence.en)) ?? [];
  expect(english.includes("“Will you buy my hair?” asked Della.")).toBe(true);
  expect(english.includes("I sold the watch to get the money to buy your combs.")).toBe(true);
});
