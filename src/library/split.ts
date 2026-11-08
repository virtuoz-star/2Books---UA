// Periods inside $1.87, Mr., Mrs., and a single initial like D. are not boundaries.
export function splitEnglishSentences(text: string): string[] {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (normalized.length === 0) return [];

  const sentences: string[] = [];
  let start = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const end = sentenceEnd(normalized, index);
    if (end === null) continue;
    pushSentence(sentences, normalized.slice(start, end + 1));
    start = end + 1;
    index = end;
  }
  pushSentence(sentences, normalized.slice(start));
  return sentences;
}

function pushSentence(sentences: string[], raw: string): void {
  const sentence = raw.replaceAll(/\s+/g, " ").trim();
  if (sentence.length > 0) sentences.push(sentence);
}

function sentenceEnd(text: string, index: number): number | null {
  const mark = text[index];
  if (mark !== "." && mark !== "!" && mark !== "?") return null;
  if (mark === "." && (isDecimalPoint(text, index) || isAbbrevOrInitial(text, index))) return null;
  let end = index;
  while (end + 1 < text.length) {
    const next = text[end + 1];
    if (next !== "." && next !== "!" && next !== "?") break;
    end += 1;
  }
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
  if (word === "Mr" || word === "Mrs") return true;
  if (word.length !== 1 || word < "A" || word > "Z") return false;
  if (start === 0) return true;
  const before = text[start - 1] ?? "";
  return before === " " || before === "\n" || before === "\t";
}

function isDigit(character: string): boolean {
  return character >= "0" && character <= "9";
}

function isLetter(character: string): boolean {
  return (character >= "A" && character <= "Z") || (character >= "a" && character <= "z");
}
