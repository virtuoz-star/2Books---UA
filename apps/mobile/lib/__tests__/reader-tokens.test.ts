import { expect, test } from "bun:test";

import { sentenceTokens } from "../../../../src/reader/tokens";

declare const Bun: {
  file(path: URL): { text(): Promise<string> };
};

function words(text: string): string[] {
  return sentenceTokens(text).flatMap((token) => (token.kind === "word" ? [token.text] : []));
}

test("a dash and curly quotes are separate words", () => {
  expect(words("said—quietly")).toEqual(["said", "quietly"]);
  expect(words("“Hello,”")).toEqual(["Hello"]);
});

test("the phone reader uses the shared tokenizer", async () => {
  const source = await Bun.file(new URL("../../components/reader.tsx", import.meta.url)).text();
  expect(source.includes("src/reader/tokens")).toBe(true);
  expect(source.includes("matchAll(/\\s+|\\S+/g)")).toBe(false);
});
