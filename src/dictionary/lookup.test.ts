import { expect, test } from "vite-plus/test";

import { glosses } from "#/dictionary/glossary";
import { lookupWord } from "#/dictionary/lookup";

const required = [
  "dollar",
  "cent",
  "cents",
  "penny",
  "pennies",
  "christmas",
  "count",
  "counted",
  "cheek",
  "cheeks",
  "grocer",
  "butcher",
  "couch",
  "howl",
  "flat",
  "week",
  "letter",
  "card",
  "prosperity",
  "income",
  "window",
  "gray",
  "fence",
  "present",
  "hair",
  "watch",
  "gold",
  "father",
  "queen",
  "king",
  "glass",
  "mirror",
  "tear",
  "carpet",
  "jacket",
  "hat",
  "door",
  "stair",
  "street",
  "madame",
  "buy",
  "twenty",
  "chain",
  "platinum",
  "store",
  "home",
  "curl",
  "gas",
  "coffee",
  "chop",
  "chops",
  "prayer",
  "pretty",
  "overcoat",
  "gloves",
  "stare",
  "gift",
  "combs",
  "tortoise",
  "shell",
  "package",
  "string",
  "paper",
  "scream",
  "tears",
  "sold",
  "wise",
  "magi",
  "give",
  "love",
  "beautiful",
  "quick",
  "hour",
  "minute",
  "table",
  "hand",
  "pocket",
  "one",
  "two",
  "three",
  "eighty",
  "eighty-seven",
  "sixty",
  "della",
  "jim",
] as const;

test("Pennies has a different gloss in Ukrainian and Russian", () => {
  const uk = lookupWord("Pennies", "uk");
  const ru = lookupWord("Pennies", "ru");
  expect(uk).toBeTruthy();
  expect(ru).toBeTruthy();
  expect(uk).not.toBe(ru);
});

test("possessive apostrophes do not throw and share the lemma", () => {
  expect(lookupWord("one's", "uk")).toBe(lookupWord("one", "uk"));
  expect(lookupWord("one’s", "uk")).toBe(lookupWord("one", "uk"));
  expect(lookupWord("one's", "ru")).toBe(lookupWord("one’s", "ru"));
  expect(lookupWord("one's", "uk")).toBeTruthy();
});

test("combs is glossed in both languages", () => {
  expect(lookupWord("combs", "uk")).toBeTruthy();
  expect(lookupWord("combs", "ru")).toBeTruthy();
});

test("empty tokens are null", () => {
  expect(lookupWord("", "uk")).toBeNull();
  expect(lookupWord("...", "ru")).toBeNull();
  expect(lookupWord("…", "uk")).toBeNull();
  expect(lookupWord("   ", "ru")).toBeNull();
});

test("a word outside the reading list is null", () => {
  expect(lookupWord("xylophone", "uk")).toBeNull();
  expect(lookupWord("xylophone", "ru")).toBeNull();
  expect(lookupWord("xylophone's", "uk")).toBeNull();
});

test("inherited object keys are not glosses", () => {
  expect(lookupWord("constructor", "uk")).toBeNull();
  expect(lookupWord("constructor", "ru")).toBeNull();
  expect(lookupWord("__proto__", "uk")).toBeNull();
  expect(lookupWord("__proto__", "ru")).toBeNull();
  expect(lookupWord("toString", "uk")).toBeNull();
});

test("inflected forms fall back to a glossary lemma", () => {
  expect(Object.hasOwn(glosses, "watched")).toBe(false);
  expect(lookupWord("watched", "ru")).toBe(lookupWord("watch", "ru"));
  expect(Object.hasOwn(glosses, "watching")).toBe(false);
  expect(lookupWord("watching", "uk")).toBe(lookupWord("watch", "uk"));
  expect(Object.hasOwn(glosses, "quicker")).toBe(false);
  expect(lookupWord("quicker", "uk")).toBe(lookupWord("quick", "uk"));
  expect(Object.hasOwn(glosses, "prettier")).toBe(false);
  expect(lookupWord("prettier", "ru")).toBe(lookupWord("pretty", "ru"));
});

test("lookup is case-insensitive", () => {
  expect(lookupWord("WATCH", "uk")).toBe(lookupWord("watch", "uk"));
  expect(lookupWord("PeNnIeS", "ru")).toBe(lookupWord("pennies", "ru"));
  expect(lookupWord("COMBS", "uk")).toBe(lookupWord("combs", "uk"));
});

test("edge punctuation is stripped before lookup", () => {
  expect(lookupWord("“Pennies!”", "uk")).toBe(lookupWord("pennies", "uk"));
  expect(lookupWord("  hair—", "ru")).toBe(lookupWord("hair", "ru"));
  expect(lookupWord("(combs)", "uk")).toBe(lookupWord("combs", "uk"));
  expect(lookupWord("Della's", "ru")).toBe(lookupWord("della", "ru"));
});

test("required reading words have a gloss in both languages", () => {
  for (const word of required) {
    expect(lookupWord(word, "uk"), word).toBeTruthy();
    expect(lookupWord(word, "ru"), word).toBeTruthy();
  }
});

test("every lemma has both glosses", () => {
  const lemmas = Object.keys(glosses);
  expect(lemmas.length).toBeGreaterThanOrEqual(80);
  for (const lemma of lemmas) {
    expect(lemma).toBe(lemma.toLowerCase());
    expect(glosses[lemma]?.uk).toBeTruthy();
    expect(glosses[lemma]?.ru).toBeTruthy();
  }
});
