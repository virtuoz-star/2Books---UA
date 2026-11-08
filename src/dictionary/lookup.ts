import { glosses } from "#/dictionary/glossary";
import type { NativeLanguage } from "#/i18n/types";

const edgePunctuation = new Set<string>([
  ",",
  ".",
  "?",
  "!",
  ";",
  ":",
  "'",
  '"',
  "`",
  "‘",
  "’",
  "“",
  "”",
  "—",
  "–",
  "-",
  "…",
  "(",
  ")",
  "[",
  "]",
]);

function isEdge(character: string): boolean {
  return edgePunctuation.has(character) || character.trim() === "";
}

function normalize(word: string): string {
  let start = 0;
  let end = word.length;
  while (start < end && isEdge(word.charAt(start))) start += 1;
  while (end > start && isEdge(word.charAt(end - 1))) end -= 1;
  return word.slice(start, end).toLowerCase().replaceAll("’", "'").replaceAll("‘", "'");
}

/** A trailing 's, straight or curly, falls back to the lemma. */
function possessiveStem(token: string): string | null {
  if (token.length < 3 || !token.endsWith("'s")) return null;
  const stem = token.slice(0, -2);
  return stem.length > 0 ? stem : null;
}

export function lookupWord(word: string, language: NativeLanguage): string | null {
  const token = normalize(word);
  if (token === "") return null;

  const direct = glosses[token];
  if (direct) return direct[language];

  const stem = possessiveStem(token);
  if (stem === null) return null;
  return glosses[stem]?.[language] ?? null;
}
