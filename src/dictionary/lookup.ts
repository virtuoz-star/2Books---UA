import { glosses } from "./glossary";
import type { NativeLanguage } from "../i18n/types";

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

export function normalizeWord(word: string): string {
  let start = 0;
  let end = word.length;
  while (start < end && isEdge(word.charAt(start))) start += 1;
  while (end > start && isEdge(word.charAt(end - 1))) end -= 1;
  return word.slice(start, end).toLowerCase().replaceAll("’", "'").replaceAll("‘", "'");
}

function addCandidate(list: string[], token: string, value: string): void {
  if (value.length < 2 || value === token || list.includes(value)) return;
  list.push(value);
}

/** Possessive, plural, past, -ing, -ly, and comparative stems, most specific first. */
function baseCandidates(token: string): string[] {
  const list: string[] = [];
  if (token.endsWith("'s")) addCandidate(list, token, token.slice(0, -2));
  if (token.endsWith("ies") && token.length > 4) addCandidate(list, token, `${token.slice(0, -3)}y`);
  if (token.endsWith("ied") && token.length > 4) addCandidate(list, token, `${token.slice(0, -3)}y`);
  if (token.endsWith("ier") && token.length > 4) addCandidate(list, token, `${token.slice(0, -3)}y`);
  if (token.endsWith("iest") && token.length > 5) addCandidate(list, token, `${token.slice(0, -4)}y`);
  if (token.endsWith("ily") && token.length > 4) addCandidate(list, token, `${token.slice(0, -3)}y`);
  if (token.endsWith("ing") && token.length > 5) {
    const stem = token.slice(0, -3);
    addCandidate(list, token, `${stem}e`);
    const last = stem.at(-1) ?? "";
    if (stem.length >= 3 && last === stem.at(-2) && !["a", "e", "i", "o", "u"].includes(last)) {
      addCandidate(list, token, stem.slice(0, -1));
    }
    addCandidate(list, token, stem);
  }
  if (token.endsWith("ed") && token.length > 4) {
    addCandidate(list, token, token.slice(0, -1));
    addCandidate(list, token, token.slice(0, -2));
  }
  if (token.endsWith("es") && token.length > 3) addCandidate(list, token, token.slice(0, -2));
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    addCandidate(list, token, token.slice(0, -1));
  }
  if (token.endsWith("ly") && token.length > 4) addCandidate(list, token, token.slice(0, -2));
  if (token.endsWith("est") && token.length > 4) {
    addCandidate(list, token, token.slice(0, -2));
    addCandidate(list, token, token.slice(0, -3));
  }
  if (token.endsWith("er") && token.length > 3) {
    addCandidate(list, token, token.slice(0, -1));
    addCandidate(list, token, token.slice(0, -2));
  }
  return list;
}

function glossOf(token: string, language: NativeLanguage): string | null {
  if (!Object.hasOwn(glosses, token)) return null;
  const entry = glosses[token];
  if (entry === undefined) return null;
  const text = entry[language];
  return typeof text === "string" && text.length > 0 ? text : null;
}

export function lookupWord(word: string, language: NativeLanguage): string | null {
  const token = normalizeWord(word);
  if (token === "") return null;

  const direct = glossOf(token, language);
  if (direct !== null) return direct;

  for (const candidate of baseCandidates(token)) {
    const gloss = glossOf(candidate, language);
    if (gloss !== null) return gloss;
  }
  return null;
}
