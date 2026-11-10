import { expect, test } from "vite-plus/test";

import {
  mergeProgress,
  preferProgress,
  progressAfterClose,
  progressForOpenedChapter,
  readProgressList,
  rememberProgress,
  writeProgressList,
  type LocalProgress,
} from "./progress";

function entry(
  bookId: string,
  chapterId: string,
  sentenceId: string | null,
  updatedAt: number,
): LocalProgress {
  return { bookId, chapterId, sentenceId, updatedAt };
}

test("two books keep separate positions", () => {
  let entries: LocalProgress[] = [];
  entries = rememberProgress(entries, entry("a", "c5", "s1", 1));
  entries = rememberProgress(entries, entry("b", "c2", "s9", 2));
  entries = rememberProgress(entries, entry("a", "c5", "s3", 3));
  expect(entries.find((row) => row.bookId === "a")).toMatchObject({
    chapterId: "c5",
    sentenceId: "s3",
  });
  expect(entries.find((row) => row.bookId === "b")).toMatchObject({
    chapterId: "c2",
    sentenceId: "s9",
  });

  const storage = {
    value: "",
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
  expect(writeProgressList(storage, entries)).toBe(true);
  expect(readProgressList(storage).map((row) => row.bookId).sort()).toEqual(["a", "b"]);
});

test("closing the panel keeps the saved sentence", () => {
  const saved = entry("a", "c1", "s4", 10);
  expect(progressAfterClose(saved)).toEqual(saved);
  expect(progressAfterClose(saved).sentenceId).toBe("s4");
  expect(progressForOpenedChapter(saved, "a", "c1", 11)).toBeNull();
});

test("opening a different part does not keep the old sentence", () => {
  const saved = entry("a", "c5", "s4", 10);
  expect(progressForOpenedChapter(saved, "a", "c2", 12)).toEqual({
    bookId: "a",
    chapterId: "c2",
    sentenceId: null,
    updatedAt: 12,
  });
});

test("merged progress keeps each book and prefers the newer row", () => {
  const merged = mergeProgress(
    [entry("a", "c5", "local", 30), entry("c", "c1", "only-local", 4)],
    [entry("a", "c1", "remote", 10), entry("b", "c2", "only-remote", 20)],
  );
  expect(merged.map((row) => row.bookId)).toEqual(["a", "b", "c"]);
  expect(merged[0]?.sentenceId).toBe("local");
});

test("the newer position wins when a reader signs in", () => {
  const local = entry("a", "c3", "s2", 20);
  const remote = entry("a", "c1", "s1", 10);
  expect(preferProgress(local, remote)).toBe(local);
  expect(preferProgress(remote, { ...local, updatedAt: 5 })).toEqual(remote);
  expect(preferProgress(null, remote)).toBe(remote);
  expect(preferProgress(local, null)).toBe(local);
});
