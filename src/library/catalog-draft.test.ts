import { expect, test } from "vite-plus/test";

import { alignedSentenceLines, catalogLimits, prepareCatalogBook } from "#/library/catalog-draft";

function draft(
  sentences: { en: string; uk: string; ru: string }[] = [
    { en: " Snow. ", uk: " Сніг. ", ru: " Снег. " },
  ],
) {
  return {
    id: " winter-note ",
    author: " A. Writer ",
    title: { uk: " Зима ", ru: " Зима ", en: " Winter " },
    chapters: [
      {
        title: { uk: " Частина ", ru: " Часть ", en: " Part " },
        sentences,
      },
    ],
  };
}

test("prepares a public book with continuous sentence ids", () => {
  const result = prepareCatalogBook({
    ...draft(),
    chapters: [
      {
        title: { uk: "Перша", ru: "Первая", en: "First" },
        sentences: [
          { en: "One.", uk: "Раз.", ru: "Раз." },
          { en: "Two.", uk: "Два.", ru: "Два." },
        ],
      },
      {
        title: { uk: "Друга", ru: "Вторая", en: "Second" },
        sentences: [{ en: "Three.", uk: "Три.", ru: "Три." }],
      },
    ],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.book.id).toBe("winter-note");
  expect(result.book.author).toBe("A. Writer");
  expect(result.book.chapters.map((chapter) => chapter.id)).toEqual(["c1", "c2"]);
  expect(
    result.book.chapters.flatMap((chapter) => chapter.sentences.map((sentence) => sentence.id)),
  ).toEqual(["s1", "s2", "s3"]);
  expect(result.book.chapters[1]?.sentences[0]?.en).toBe("Three.");
});

test("trims the address, titles, and sentence text", () => {
  const result = prepareCatalogBook(draft());
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.book.id).toBe("winter-note");
  expect(result.book.author).toBe("A. Writer");
  expect(result.book.title.en).toBe("Winter");
  expect(result.book.chapters[0]?.sentences[0]).toEqual({
    id: "s1",
    en: "Snow.",
    uk: "Сніг.",
    ru: "Снег.",
  });
});

test("rejects the bundled book id and malformed addresses", () => {
  expect(prepareCatalogBook({ ...draft(), id: "gift-of-the-magi" })).toEqual({
    ok: false,
    error: "reserved-id",
  });
  for (const id of ["Gift", "winter_note", "winter-", "-winter", "winter note", ""]) {
    expect(prepareCatalogBook({ ...draft(), id }).ok).toBe(false);
  }
  expect(prepareCatalogBook({ ...draft(), id: "a".repeat(catalogLimits.maxIdLength) }).ok).toBe(
    true,
  );
  expect(prepareCatalogBook({ ...draft(), id: "a".repeat(catalogLimits.maxIdLength + 1) }).ok).toBe(
    false,
  );
});

test("aligns pasted lines and rejects a mismatched part", () => {
  const aligned = alignedSentenceLines("One.\nTwo.", " Раз. \nДва.", "Раз.\nДва.");
  expect(aligned).toEqual({
    ok: true,
    sentences: [
      { en: "One.", uk: "Раз.", ru: "Раз." },
      { en: "Two.", uk: "Два.", ru: "Два." },
    ],
  });
  expect(alignedSentenceLines("One.", "Раз.\nДва.", "Раз.").ok).toBe(false);
  expect(alignedSentenceLines("One.\n\nTwo.", "Раз.\nДва.", "Раз.\nДва.").ok).toBe(false);
});

test("rejects missing translations, empty chapters, and oversized books", () => {
  expect(prepareCatalogBook({ ...draft([{ en: "Snow.", uk: " ", ru: "Снег." }]) }).ok).toBe(false);
  expect(prepareCatalogBook({ ...draft(), chapters: [] }).ok).toBe(false);
  expect(
    prepareCatalogBook({
      ...draft(),
      chapters: [{ title: { uk: "Частина", ru: "Часть", en: "Part" }, sentences: [] }],
    }).ok,
  ).toBe(false);
  expect(prepareCatalogBook({ ...draft(), author: " " }).ok).toBe(false);
  const huge = {
    en: "e".repeat(catalogLimits.maxSentenceLength),
    uk: "u".repeat(catalogLimits.maxSentenceLength),
    ru: "r".repeat(catalogLimits.maxSentenceLength),
  };
  const sentences = Array.from({ length: 80 }, () => huge);
  expect(prepareCatalogBook(draft(sentences)).ok).toBe(false);
  expect(
    prepareCatalogBook({
      ...draft(),
      chapters: Array.from({ length: catalogLimits.maxChapters + 1 }, () => draft().chapters[0]),
    }).ok,
  ).toBe(false);
});
