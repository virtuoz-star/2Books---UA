// Periods inside $1.87, titles (Mr., Dr.), initials, and dotted forms (a.m., e.g.) are not boundaries.
const closers = new Set(["\"", "”", "’", "'", ")", "]", "»"]);
const abbreviations = new Set(["mr", "mrs", "dr", "ms", "st", "jr", "sr", "prof", "vs", "etc"]);

export type EnglishPart = { text: string; paragraph: number };

export function splitEnglishSentences(text: string): string[] {
  return splitEnglishParts(text).map((part) => part.text);
}

/** Splits on sentence boundaries and on blank lines. Paragraph numbers start at 0. */
export function splitEnglishParts(text: string): EnglishPart[] {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (normalized.length === 0) return [];
  const parts: EnglishPart[] = [];
  const paragraphs = normalized.split(/\n[ \t]*\n/);
  for (let paragraph = 0; paragraph < paragraphs.length; paragraph += 1) {
    for (const sentence of sentencesIn(paragraphs[paragraph] ?? "")) {
      parts.push({ text: sentence, paragraph });
    }
  }
  return parts;
}

function sentencesIn(paragraph: string): string[] {
  const text = paragraph.trim();
  if (text.length === 0) return [];
  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const end = boundaryEnd(text, index);
    if (end === null) continue;
    pushSentence(sentences, text.slice(start, end + 1));
    start = end + 1;
    index = end;
  }
  pushSentence(sentences, text.slice(start));
  return sentences;
}

function pushSentence(sentences: string[], raw: string): void {
  const sentence = raw.replaceAll(/\s+/g, " ").trim();
  if (sentence.length > 0) sentences.push(sentence);
}

function boundaryEnd(text: string, index: number): number | null {
  const mark = text[index];
  if (mark !== "." && mark !== "!" && mark !== "?") return null;
  if (mark === "." && (isDecimalPoint(text, index) || isAbbrevOrInitial(text, index))) return null;
  let end = index;
  while (end + 1 < text.length) {
    const next = text[end + 1] ?? "";
    if (next !== "." && next !== "!" && next !== "?") break;
    end += 1;
  }
  while (end + 1 < text.length && closers.has(text[end + 1] ?? "")) end += 1;
  const after = text[end + 1];
  if (after !== undefined && !isSpace(after)) return null;
  let look = end + 1;
  while (look < text.length && isSpace(text[look] ?? "")) look += 1;
  const next = text[look];
  if (next !== undefined && next >= "a" && next <= "z") return null;
  return end;
}

function isDecimalPoint(text: string, index: number): boolean {
  const previous = text[index - 1];
  const next = text[index + 1];
  return previous !== undefined && next !== undefined && isDigit(previous) && isDigit(next);
}

function isAbbrevOrInitial(text: string, index: number): boolean {
  let start = index;
  while (start > 0 && isLetter(text[start - 1] ?? "")) start -= 1;
  const word = text.slice(start, index);
  if (abbreviations.has(word.toLowerCase())) return true;
  if (word.length !== 1 || word < "A" || word > "Z") return false;
  if (start === 0) return true;
  const before = text[start - 1] ?? "";
  return before === " " || before === "\n" || before === "\t";
}

function isSpace(character: string): boolean {
  return character === " " || character === "\n" || character === "\t";
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isLetter(character: string): boolean {
  return (character >= "A" && character <= "Z") || (character >= "a" && character <= "z");
}
