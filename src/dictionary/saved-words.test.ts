import { expect, test } from "vite-plus/test";

import {
  addSavedWord,
  ankiDeck,
  clampSavedWordTimes,
  hasSavedWord,
  mergeWordStores,
  parseSavedWordStore,
  parseSavedWords,
  removeSavedWord,
  savedWordKey,
  savedWordLimit,
  tombstoneLimit,
  type SavedWord,
  type SavedWordStore,
} from "#/dictionary/saved-words";

function word(
  spelling: string,
  gloss: string,
  savedAt: number,
  sentenceEn = "",
  sentenceNative = "",
): SavedWord {
  return {
    word: spelling,
    gloss,
    nativeLanguage: "uk",
    savedAt,
    sentenceEn,
    sentenceNative,
    bookId: "",
    chapterId: "",
    sentenceId: "",
    bookSource: "",
  };
}

function storeOf(
  words: SavedWord[],
  tombstones: SavedWordStore["tombstones"] = [],
): SavedWordStore {
  return { words, tombstones };
}

test("a saved word keeps the normalized spelling and the newest gloss", () => {
  expect(savedWordKey("“Pennies!”", "uk")).toBe("uk:pennies");
  expect(savedWordKey("...", "ru")).toBeNull();
  const first = addSavedWord(storeOf([]), {
    word: "Pennies",
    gloss: "старий",
    nativeLanguage: "uk",
    savedAt: 1,
    sentenceEn: "",
    sentenceNative: "",
  });
  const second = addSavedWord(first, {
    word: " pennies ",
    gloss: "пенні",
    nativeLanguage: "uk",
    savedAt: 2,
    sentenceEn: "",
    sentenceNative: "",
  });
  expect(second.words).toEqual([word("pennies", "пенні", 2)]);
  expect(hasSavedWord(second.words, "PENNIES", "uk")).toBe(true);
  expect(hasSavedWord(second.words, "pennies", "ru")).toBe(false);
  expect(removeSavedWord(second, "pennies", "uk", 3).words).toEqual([]);
});

test("stored words drop broken rows and extra fields", () => {
  const words = parseSavedWords([
    { word: "hair", gloss: "волосся", nativeLanguage: "uk", savedAt: 2, note: "ignore" },
    { word: "", gloss: "x", nativeLanguage: "uk", savedAt: 3 },
    { word: "watch", gloss: "часы", nativeLanguage: "ru", savedAt: 1 },
    null,
  ]);
  expect(words.map((item) => item.word)).toEqual(["hair", "watch"]);
  expect(words[0]).not.toHaveProperty("note");
  expect(words[0]?.sentenceEn).toBe("");
  expect(words[0]?.sentenceNative).toBe("");
  expect(words[0]?.bookId).toBe("");
});

test("a saved word keeps the sentence it was met in", () => {
  const stored = addSavedWord(storeOf([]), {
    word: "combs",
    gloss: "гребінці",
    nativeLanguage: "uk",
    savedAt: 4,
    sentenceEn: "She bought the combs.",
    sentenceNative: "Вона купила гребінці.",
    bookId: "gift-of-the-magi",
    chapterId: "c1",
    sentenceId: "s5",
    bookSource: "catalog",
  });
  expect(stored.words[0]).toEqual({
    ...word("combs", "гребінці", 4, "She bought the combs.", "Вона купила гребінці."),
    bookId: "gift-of-the-magi",
    chapterId: "c1",
    sentenceId: "s5",
    bookSource: "catalog",
  });
  const broken = parseSavedWords([
    {
      word: "hair",
      gloss: "волосся",
      nativeLanguage: "uk",
      savedAt: 1,
      bookId: "../secret",
      chapterId: "c1",
      sentenceId: "s1",
      bookSource: "catalog",
    },
  ]);
  expect(broken[0]?.bookId).toBe("");
  expect(broken[0]?.bookSource).toBe("");
});

test("a legacy row without sentence fields parses as empty sentences", () => {
  const parsed = parseSavedWordStore([
    { word: "pennies", gloss: "пенні", nativeLanguage: "uk", savedAt: 2 },
  ]);
  expect(parsed.words).toEqual([word("pennies", "пенні", 2)]);
  expect(parsed.tombstones).toEqual([]);
});

test("re-saving the same word replaces the gloss, both sentences, and the time", () => {
  const first = addSavedWord(storeOf([]), {
    word: "pennies",
    gloss: "старий",
    nativeLanguage: "uk",
    savedAt: 1,
    sentenceEn: "Old.",
    sentenceNative: "Старе.",
  });
  const second = addSavedWord(first, {
    word: "pennies",
    gloss: "пенні",
    nativeLanguage: "uk",
    savedAt: 2,
    sentenceEn: "One dollar.",
    sentenceNative: "Один долар.",
  });
  expect(second.words).toEqual([word("pennies", "пенні", 2, "One dollar.", "Один долар.")]);
});

test("remove records a tombstone and a later save drops it", () => {
  const saved = addSavedWord(storeOf([]), {
    word: "pennies",
    gloss: "пенні",
    nativeLanguage: "uk",
    savedAt: 1,
    sentenceEn: "One dollar.",
    sentenceNative: "Один долар.",
  });
  const removed = removeSavedWord(saved, "pennies", "uk", 4);
  expect(removed.words).toEqual([]);
  expect(removed.tombstones).toEqual([{ word: "pennies", nativeLanguage: "uk", deletedAt: 4 }]);
  const again = addSavedWord(removed, {
    word: "pennies",
    gloss: "пенні",
    nativeLanguage: "uk",
    savedAt: 5,
    sentenceEn: "One dollar.",
    sentenceNative: "Один долар.",
  });
  expect(again.tombstones).toEqual([]);
  expect(again.words).toEqual([word("pennies", "пенні", 5, "One dollar.", "Один долар.")]);
});

test("removing a missing word still stores a tombstone on the returned store", () => {
  const removed = removeSavedWord(storeOf([]), "pennies", "uk", 4);
  expect(removed.words).toEqual([]);
  expect(removed.tombstones).toEqual([{ word: "pennies", nativeLanguage: "uk", deletedAt: 4 }]);
  const persisted = parseSavedWordStore(JSON.parse(JSON.stringify(removed)) as unknown);
  expect(persisted.tombstones).toEqual(removed.tombstones);
});

test("merge keeps the newer row, prefers a tombstone on a tie, and keeps the second text", () => {
  const older = parseSavedWordStore([word("pennies", "b", 1, "Old.", "Старе.")]);
  const newer = parseSavedWordStore([word("pennies", "a", 2, "One dollar.", "Один долар.")]);
  expect(mergeWordStores(older, newer).words).toEqual(newer.words);

  const live = parseSavedWordStore([word("pennies", "a", 5)]);
  const tomb = parseSavedWordStore({
    words: [],
    tombstones: [{ word: "pennies", nativeLanguage: "uk", deletedAt: 6 }],
  });
  expect(mergeWordStores(live, tomb).words).toEqual([]);
  expect(mergeWordStores(live, tomb).tombstones).toEqual(tomb.tombstones);

  const revived = parseSavedWordStore([word("pennies", "a", 7)]);
  expect(mergeWordStores(tomb, revived).tombstones).toEqual([]);
  expect(mergeWordStores(tomb, revived).words).toEqual(revived.words);

  const tiedTomb = parseSavedWordStore({
    words: [],
    tombstones: [{ word: "pennies", nativeLanguage: "uk", deletedAt: 5 }],
  });
  expect(mergeWordStores(live, tiedTomb).words).toEqual([]);
  expect(mergeWordStores(tiedTomb, live).words).toEqual([]);

  const lesser = parseSavedWordStore([word("pennies", "a", 5, "a", "a")]);
  const greater = parseSavedWordStore([word("pennies", "b", 5, "a", "a")]);
  expect(mergeWordStores(greater, lesser).words[0]?.gloss).toBe("b");
  expect(mergeWordStores(lesser, greater).words[0]?.gloss).toBe("b");

  const tied = parseSavedWordStore([word("pennies", "same", 5, "One dollar.", "Один долар.")]);
  const incoming = parseSavedWordStore([word("pennies", "same", 5, "One dollar.", "Один долар.")]);
  expect(mergeWordStores(tied, incoming).words).toEqual(incoming.words);
});

test("the list keeps the newest words and tombstones when it is full", () => {
  const stored = storeOf(
    Array.from({ length: savedWordLimit }, (_, index) => word(`w${index}`, "g", index)),
  );
  const next = addSavedWord(stored, {
    word: "fresh",
    gloss: "нове",
    nativeLanguage: "uk",
    savedAt: savedWordLimit,
    sentenceEn: "",
    sentenceNative: "",
  });
  expect(next.words).toHaveLength(savedWordLimit);
  expect(next.words[0]?.word).toBe("fresh");
  expect(next.words.some((item) => item.word === "w0")).toBe(false);

  const fullTombstones = parseSavedWordStore({
    words: [],
    tombstones: Array.from({ length: tombstoneLimit }, (_, index) => ({
      word: `t${index}`,
      nativeLanguage: "uk" as const,
      deletedAt: index,
    })),
  });
  const trimmed = removeSavedWord(fullTombstones, "fresh", "uk", tombstoneLimit);
  expect(trimmed.tombstones).toHaveLength(tombstoneLimit);
  expect(trimmed.tombstones[0]?.word).toBe("fresh");
  expect(trimmed.tombstones.some((item) => item.word === "t0")).toBe(false);
});

test("an Anki deck quotes a multiline back and leaves a gloss-only row plain", () => {
  const glossOnly = ankiDeck([word("pennies", "пенні", 2)]);
  expect(glossOnly).toBe(
    ["#separator:tab", "#html:false", "#notetype:Basic", "#deck:2books", "pennies\tпенні", ""].join(
      "\n",
    ),
  );
  const full = ankiDeck([
    word("pennies", "пенні", 2, "One dollar.", "Один долар."),
    word("tab", "gloss", 1, "a\tb", ""),
    word("quote", 'say "hi"', 1, "", ""),
  ]);
  expect(full).toContain('pennies\t"пенні\n\nOne dollar.\n\nОдин долар."');
  expect(full).toContain('tab\t"gloss\n\na b"');
  expect(full).not.toContain("a\tb");
  expect(full).toContain('quote\t"say ""hi"""');
});

test("clampSavedWordTimes pulls future stamps back to a few minutes past now", () => {
  const now = 1_700_000_000_000;
  const store = storeOf([word("house", "дім", now + 86_400_000)], [
    { word: "house", nativeLanguage: "uk", deletedAt: now + 86_400_000 },
  ]);
  const clamped = clampSavedWordTimes(store, now);
  expect(clamped.words[0]?.savedAt).toBe(now + 5 * 60_000);
  expect(clamped.tombstones[0]?.deletedAt).toBe(now + 5 * 60_000);
});
