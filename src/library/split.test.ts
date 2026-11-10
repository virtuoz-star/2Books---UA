import { expect, test } from "vite-plus/test";

import { splitEnglishSentences } from "#/library/split";

test("splits two sentences on a period", () => {
  expect(splitEnglishSentences("One dollar and eighty-seven cents. That was all.")).toEqual([
    "One dollar and eighty-seven cents.",
    "That was all.",
  ]);
});

test("does not split $1.87 or Mr.", () => {
  expect(splitEnglishSentences("She had $1.87 left. Mr. Jameson waited.")).toEqual([
    "She had $1.87 left.",
    "Mr. Jameson waited.",
  ]);
});

test("does not split Mrs. or a single initial", () => {
  expect(splitEnglishSentences("Mrs. D. Smith smiled.")).toEqual(["Mrs. D. Smith smiled."]);
});

test("keeps the question mark on Will you buy my hair?", () => {
  expect(splitEnglishSentences("Will you buy my hair?")).toEqual(["Will you buy my hair?"]);
  expect(splitEnglishSentences("Will you buy my hair? That was all.")).toEqual([
    "Will you buy my hair?",
    "That was all.",
  ]);
});

test("collapses whitespace and drops empty pieces", () => {
  expect(splitEnglishSentences("  One   dollar.\r\n\r\nThat   was all.  ")).toEqual([
    "One dollar.",
    "That was all.",
  ]);
});

test("keeps closing quotes and brackets with the sentence", () => {
  expect(splitEnglishSentences(`"Stop!" he cried.`)).toEqual([`"Stop!" he cried.`]);
  expect(splitEnglishSentences(`He said, "It is late." Then he left.`)).toEqual([
    `He said, "It is late."`,
    "Then he left.",
  ]);
  expect(splitEnglishSentences("(She paused.) Then she spoke.")).toEqual([
    "(She paused.)",
    "Then she spoke.",
  ]);
  expect(
    splitEnglishSentences(`"Jim, darling," she cried, "don't look at me that way."`),
  ).toEqual([`"Jim, darling," she cried, "don't look at me that way."`]);
});

test("does not split abbreviations, dotted forms, domains, or versions", () => {
  expect(
    splitEnglishSentences("Dr. Watson met St. John at 5 p.m. on Baker St. and left."),
  ).toEqual(["Dr. Watson met St. John at 5 p.m. on Baker St. and left."]);
  expect(splitEnglishSentences("See e.g. the note. See i.e. the rest.")).toEqual([
    "See e.g. the note.",
    "See i.e. the rest.",
  ]);
  expect(splitEnglishSentences("Visit example.com today. Version v2.0 shipped.")).toEqual([
    "Visit example.com today.",
    "Version v2.0 shipped.",
  ]);
});

test("a blank line is a sentence boundary and keeps paragraph numbers", async () => {
  const { splitEnglishParts } = await import("#/library/split");
  expect(splitEnglishParts("One dollar.\n\nThat was all.")).toEqual([
    { text: "One dollar.", paragraph: 0 },
    { text: "That was all.", paragraph: 1 },
  ]);
});
