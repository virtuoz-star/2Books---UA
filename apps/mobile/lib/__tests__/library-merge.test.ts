import { expect, test } from "bun:test";

import { markForBook, mergeLibrary, sameBookId } from "../library-merge";

const title = { uk: "Червоний", ru: "Красный", en: "Red" };

const local = {
  id: "red-boat",
  author: "A. Writer",
  title,
  chapterCount: 2,
};

test("a missing catalog keeps the local row", () => {
  const merged = mergeLibrary(null, [local]);
  expect(merged.catalog).toBe("missing");
  expect(merged.rows).toEqual([{ source: "local", key: "local:red-boat", book: local }]);
});

test("a book already on the phone is listed once", () => {
  const catalog = { ...local, author: "Catalog" };
  const other = { ...local, id: "blue-boat", author: "Catalog" };
  const merged = mergeLibrary([catalog, other], [local]);
  expect(merged.catalog).toBe("ready");
  expect(merged.rows.map((row) => row.key)).toEqual(["local:red-boat", "catalog:blue-boat"]);
});

test("the catalog gift is hidden when the phone copy exists", () => {
  const catalog = { ...local, id: "gift-of-the-magi" };
  const saved = { ...local, id: "gift-of-the-magi-reader" };
  const merged = mergeLibrary([catalog], [saved]);
  expect(merged.rows.map((row) => row.key)).toEqual(["local:gift-of-the-magi-reader"]);
});

test("a row finds a mark stored on the other gift id", () => {
  const marks = { "gift-of-the-magi": { ratio: 0.4 } };
  expect(markForBook(marks, "gift-of-the-magi-reader")?.ratio).toBe(0.4);
  expect(markForBook(marks, "gift-of-the-magi")?.ratio).toBe(0.4);
  expect(markForBook({ "red-boat": { ratio: 0.5 } }, "red-boat")?.ratio).toBe(0.5);
});

test("the row's own mark wins over the gift pair", () => {
  const marks = {
    "gift-of-the-magi": { ratio: 0.2 },
    "gift-of-the-magi-reader": { ratio: 0.8 },
  };
  expect(markForBook(marks, "gift-of-the-magi-reader")?.ratio).toBe(0.8);
  expect(sameBookId("gift-of-the-magi", "gift-of-the-magi-reader")).toBe(true);
  expect(sameBookId("red-boat", "blue-boat")).toBe(false);
});
