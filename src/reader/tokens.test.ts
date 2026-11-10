import { describe, expect, test } from "vite-plus/test";

import { giftOfTheMagi } from "#/content/gift-of-the-magi";
import { glosses } from "#/dictionary/glossary";

import { sentenceTokens, wordAt, wordCount } from "./tokens";

function words(text: string): string[] {
  return sentenceTokens(text).flatMap((token) => (token.kind === "word" ? [token.text] : []));
}

describe("sentenceTokens", () => {
  test("joining the tokens gives the sentence back", () => {
    const samples = [
      "One dollar and eighty-seven cents.",
      "“Hello,” she said—quietly.",
      "  Two  spaces\tand a tab ",
      "А наступного дня було Різдво.",
      "",
    ];
    for (const sample of samples) {
      expect(
        sentenceTokens(sample)
          .map((token) => token.text)
          .join(""),
      ).toBe(sample);
    }
  });

  test("punctuation is never part of a word", () => {
    expect(words("“Hello,” she said.")).toEqual(["Hello", "she", "said"]);
    expect(words("(Yes!) No?")).toEqual(["Yes", "No"]);
  });

  test("a dash between two words splits them", () => {
    expect(words("said—quietly")).toEqual(["said", "quietly"]);
    expect(words("one – two")).toEqual(["one", "two"]);
  });

  test("an inner apostrophe or hyphen stays inside the word", () => {
    expect(words("one’s cheeks")).toEqual(["one’s", "cheeks"]);
    expect(words("don't stop")).toEqual(["don't", "stop"]);
    expect(words("eighty-seven cents")).toEqual(["eighty-seven", "cents"]);
  });

  test("a leading or trailing apostrophe is a gap", () => {
    expect(words("'tis the season'")).toEqual(["tis", "the", "season"]);
  });

  test("numbers keep an inner point or comma", () => {
    expect(words("It cost $8 or 3.5 or 1,200.")).toEqual(["It", "cost", "8", "or", "3.5", "or", "1,200"]);
  });

  test("a sentence of punctuation has no words", () => {
    expect(words("— … !")).toEqual([]);
    expect(wordCount("— … !")).toBe(0);
  });

  test("word indexes count words only", () => {
    const tokens = sentenceTokens("Well — yes.");
    expect(tokens).toEqual([
      { kind: "word", index: 0, text: "Well" },
      { kind: "gap", text: " — " },
      { kind: "word", index: 1, text: "yes" },
      { kind: "gap", text: "." },
    ]);
  });

  test("Cyrillic words are words", () => {
    expect(words("Це було все.")).toEqual(["Це", "було", "все"]);
    expect(words("м’ясника й овочівника")).toEqual(["м’ясника", "й", "овочівника"]);
  });
});

describe("wordAt", () => {
  test("returns the word at an index", () => {
    expect(wordAt("That was all.", 2)).toBe("all");
  });

  test("returns null past the last word", () => {
    expect(wordAt("That was all.", 3)).toBeNull();
  });
});

function isGlue(character: string): boolean {
  if (character === "") return false;
  if (character >= "0" && character <= "9") return true;
  if (character === "'" || character === "’" || character === "-" || character === "‑") return true;
  return character.toLowerCase() !== character.toUpperCase();
}

function containsLemma(text: string, lemma: string): boolean {
  const lower = text.toLowerCase();
  const needle = lemma.toLowerCase();
  let from = 0;
  while (from <= lower.length) {
    const at = lower.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : (lower[at - 1] ?? "");
    const after = lower[at + needle.length] ?? "";
    if (!isGlue(before) && !isGlue(after)) return true;
    from = at + 1;
  }
  return false;
}

describe("bundled book", () => {
  test("every glossary lemma in the text is a token", () => {
    const hidden = [
      "sterling",
      "ornamentation",
      "value",
      "twenty-two",
      "nice",
      "sold",
      "year",
      "combs",
      "men",
      "wonderfully",
    ];
    const seen = new Set<string>();
    const missed: string[] = [];
    for (const chapter of giftOfTheMagi.chapters) {
      for (const sentence of chapter.sentences) {
        const tokens = sentenceTokens(sentence.en).flatMap((token) =>
          token.kind === "word" ? [token.text.toLowerCase()] : [],
        );
        for (const token of tokens) seen.add(token);
        for (const lemma of Object.keys(glosses)) {
          if (containsLemma(sentence.en, lemma) && !tokens.includes(lemma)) {
            missed.push(`${sentence.id}:${lemma}`);
          }
        }
      }
    }
    expect(missed).toEqual([]);
    for (const lemma of hidden) expect(seen.has(lemma)).toBe(true);
  });
});
