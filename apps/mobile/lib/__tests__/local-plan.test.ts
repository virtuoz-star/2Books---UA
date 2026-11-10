import { expect, test } from "bun:test";

import {
  archiveNameAllowed,
  archiveSizeAllowed,
  importDeletesSource,
  indexJsonKind,
  localLoadStatus,
  planVersion1Recovery,
  positionAfterReplace,
  resolveLocalSlug,
  sharedUriAllowed,
  shouldSkipInitialIntent,
  shouldWriteParsedJson,
} from "../local-plan";

const title = { uk: "Червоний", ru: "Красный", en: "Red" };

test("../x fails the path guard", () => {
  expect(resolveLocalSlug("../x")).toBeNull();
  expect(localLoadStatus("../x", true)).toBe("rejected");
});

test("gift-of-the-magi passes the guard and is a missing book", () => {
  expect(resolveLocalSlug("gift-of-the-magi")).toBe("gift-of-the-magi");
  expect(localLoadStatus("gift-of-the-magi", false)).toBe("missing");
});

test("a sentence id that still exists keeps that chapter", () => {
  expect(
    positionAfterReplace({ chapterId: "c1", sentenceId: "s2" }, [
      { id: "c1", sentences: [{ id: "s1" }] },
      { id: "c9", sentences: [{ id: "s2" }] },
    ]),
  ).toEqual({ chapterId: "c9", sentenceId: "s2" });
});

test("a missing, empty, or null sentence id drops the position", () => {
  const chapters = [{ id: "c1", sentences: [{ id: "s1" }] }];
  expect(positionAfterReplace({ chapterId: "c1", sentenceId: "s9" }, chapters)).toBeNull();
  expect(positionAfterReplace({ chapterId: "c1", sentenceId: "" }, chapters)).toBeNull();
  expect(positionAfterReplace({ chapterId: "c1", sentenceId: null }, chapters)).toBeNull();
  expect(positionAfterReplace(null, chapters)).toBeNull();
});

test("the picker name and size rules skip a read", () => {
  expect(archiveNameAllowed(null)).toBe(true);
  expect(archiveNameAllowed("")).toBe(true);
  expect(archiveNameAllowed("notebook")).toBe(true);
  expect(archiveNameAllowed("Story.2BOOKS")).toBe(true);
  expect(archiveNameAllowed("notes.pdf")).toBe(false);
  expect(archiveSizeAllowed(undefined)).toBe(true);
  expect(archiveSizeAllowed(Number.NaN)).toBe(true);
  expect(archiveSizeAllowed(25_000_000)).toBe(true);
  expect(archiveSizeAllowed(25_000_001)).toBe(false);
});

test("a lone incoming folder is deleted and a dot-dot cache path is refused", () => {
  const plan = planVersion1Recovery({
    children: ["red-boat.incoming"],
    index: [],
    books: {
      "red-boat.incoming": {
        id: "red-boat",
        author: "A. Writer",
        title,
        importedAt: 5,
        chapters: [{ id: "c1" }],
      },
    },
  });
  expect(plan.actions).toEqual([{ type: "delete", name: "red-boat.incoming" }]);
  expect(plan.index).toEqual([]);
  const roots = {
    documentHref: "file:///data/user/0/com.twobooks.reader/files/",
    cacheHref: "file:///data/user/0/com.twobooks.reader/cache/",
  };
  expect(
    sharedUriAllowed(
      "file:///data/user/0/com.twobooks.reader/cache/../files/2books/words.json",
      "ios",
      roots,
    ),
  ).toBe(false);
  expect(
    sharedUriAllowed(
      "file:///data/user/0/com.twobooks.reader/cache/%2E%2E/files/2books/words.json",
      "android",
      roots,
    ),
  ).toBe(false);
  expect(
    sharedUriAllowed("file:///private/var/mobile/Containers/Shared/AppGroup/inbox/Book.2books", "ios", roots),
  ).toBe(true);
  expect(sharedUriAllowed("file:///sdcard/Download/Book.2books", "android", roots)).toBe(false);
  expect(sharedUriAllowed("content://downloads/document/1", "android", roots)).toBe(true);
  expect(importDeletesSource(undefined)).toBe(false);
  expect(importDeletesSource(true)).toBe(true);
});

test("an unparsable index is missing and another version stays foreign", () => {
  expect(indexJsonKind({ books: [] })).toBe("missing");
  expect(indexJsonKind([])).toBe("missing");
  expect(indexJsonKind({ version: 2, books: [] })).toBe("foreign");
  expect(indexJsonKind({ version: 1, books: [] })).toBe("ready");
});

test("a relaunched initial intent is skipped only when the handled url matches", () => {
  const handled = { url: "content://downloads/document/1", at: 10 };
  expect(shouldSkipInitialIntent(true, "content://downloads/document/1", handled)).toBe(true);
  expect(shouldSkipInitialIntent(false, "content://downloads/document/1", handled)).toBe(false);
  expect(shouldSkipInitialIntent(true, "content://downloads/document/2", handled)).toBe(false);
  expect(shouldSkipInitialIntent(true, "content://downloads/document/1", { url: handled.url, at: Number.NaN })).toBe(
    false,
  );
  expect(shouldWriteParsedJson({ words: [] }, { words: [] })).toBe(false);
  expect(shouldWriteParsedJson({ words: [] }, { words: [{ word: "gate" }] })).toBe(true);
});

test("version-1 recovery restores previous and drops a missing index id", () => {
  const index = [
    { id: "red-boat", author: "A. Writer", title, chapterCount: 1, importedAt: 5 },
    { id: "missing-id", author: "B. Writer", title, chapterCount: 1, importedAt: 4 },
  ];
  const plan = planVersion1Recovery({
    children: [
      "red-boat.incoming",
      "red-boat.previous",
      "../x.previous",
      "red-boat.incoming.previous",
    ],
    index,
    books: {
      "red-boat.previous": {
        id: "red-boat",
        author: "A. Writer",
        title,
        importedAt: 5,
        chapters: [{ id: "c1" }, { id: "c2" }],
      },
    },
  });
  expect(plan.actions).toEqual([
    { type: "move", from: "red-boat.previous", to: "red-boat", overwrite: true },
    { type: "delete", name: "red-boat.incoming" },
  ]);
  expect(plan.index).toEqual([
    { id: "red-boat", author: "A. Writer", title, chapterCount: 2, importedAt: 5 },
  ]);
  expect(index[0]?.chapterCount).toBe(1);
});
