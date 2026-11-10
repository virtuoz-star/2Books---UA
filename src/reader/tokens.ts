export type SentenceToken =
  | { kind: "word"; index: number; text: string }
  | { kind: "gap"; text: string };

// Shared by the website and the phone reader. Hermes runs this file, so it avoids
// Unicode property escapes and walks code points by hand.

const digitJoiners = new Set([".", ","]);
const letterJoiners = new Set(["'", "’", "-", "‑"]);

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isWordCharacter(character: string): boolean {
  if (isDigit(character)) return true;
  // Cased scripts: Latin, Cyrillic, Greek, Armenian.
  if (character.toLowerCase() !== character.toUpperCase()) return true;
  const code = character.codePointAt(0) ?? 0;
  // Combining marks stay inside the word they decorate.
  if (code >= 0x0300 && code <= 0x036f) return true;
  // Letters without case (Hebrew, Arabic, CJK and the rest) count as word text.
  // General punctuation and symbols sit in U+2000..U+2BFF and stay gaps.
  if (code >= 0x05d0 && code < 0x2000) return true;
  return code >= 0x2e80;
}

/**
 * Splits a sentence into words and the gaps between them.
 * A word is letters and digits, with an inner apostrophe or hyphen ("one’s",
 * "eighty-seven") or an inner point between digits ("3.5"). Quotes, dashes and
 * other punctuation are gaps, so "said—quietly" is two words.
 * Joining every token's text gives the sentence back unchanged.
 */
export function sentenceTokens(text: string): SentenceToken[] {
  const characters = Array.from(text);
  const tokens: SentenceToken[] = [];
  let wordIndex = 0;
  let word = "";
  let gap = "";

  const flushWord = () => {
    if (word === "") return;
    tokens.push({ kind: "word", index: wordIndex, text: word });
    wordIndex += 1;
    word = "";
  };
  const flushGap = () => {
    if (gap === "") return;
    tokens.push({ kind: "gap", text: gap });
    gap = "";
  };

  for (let position = 0; position < characters.length; position += 1) {
    const character = characters[position] ?? "";
    if (isWordCharacter(character)) {
      flushGap();
      word += character;
      continue;
    }
    const previous = position > 0 ? (characters[position - 1] ?? "") : "";
    const next = characters[position + 1] ?? "";
    const joinsLetters =
      letterJoiners.has(character) && isWordCharacter(previous) && isWordCharacter(next);
    const joinsDigits = digitJoiners.has(character) && isDigit(previous) && isDigit(next);
    if (word !== "" && (joinsLetters || joinsDigits)) {
      word += character;
      continue;
    }
    flushWord();
    gap += character;
  }
  flushWord();
  flushGap();
  return tokens;
}

/** The word token at a word index, or null when the sentence has no such word. */
export function wordAt(text: string, index: number): string | null {
  for (const token of sentenceTokens(text)) {
    if (token.kind === "word" && token.index === index) return token.text;
  }
  return null;
}

export function wordCount(text: string): number {
  let count = 0;
  for (const token of sentenceTokens(text)) {
    if (token.kind === "word") count += 1;
  }
  return count;
}
