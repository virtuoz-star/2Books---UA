import { splitEnglishParts } from "#/library/split";

export const maxTitleLength = 120;
export const maxTextLength = 100_000;
export const maxSentences = 200;
const maxSentenceChars = 1_000;

export type UploadSentence = { text: string; paragraph: number };

export type UploadCounts = {
  sentences: number;
  maxSentences: number;
  characters: number;
  maxCharacters: number;
};

export function measureUpload(text: string): { sentences: number; characters: number } {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { sentences: 0, characters: 0 };
  const parts = splitEnglishParts(trimmed);
  let sentences = 0;
  for (const part of parts) sentences += wrapSentence(part.text).length;
  return { sentences, characters: trimmed.length };
}

export function prepareUpload(
  title: string,
  text: string,
):
  | { ok: true; title: string; sentences: UploadSentence[] }
  | ({ ok: false; error: "invalid-input" | "too-long" } & Partial<UploadCounts>) {
  if (typeof title !== "string" || typeof text !== "string") {
    return { ok: false, error: "invalid-input" };
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > maxTitleLength) {
    return { ok: false, error: "invalid-input" };
  }
  const trimmedText = text.trim();
  const counts = {
    maxSentences,
    maxCharacters: maxTextLength,
    characters: trimmedText.length,
  };
  if (trimmedText.length > maxTextLength) {
    return { ok: false, error: "too-long", ...counts, sentences: 0 };
  }
  const sentences: UploadSentence[] = [];
  for (const part of splitEnglishParts(trimmedText)) {
    for (const piece of wrapSentence(part.text)) {
      sentences.push({ text: piece, paragraph: part.paragraph });
    }
  }
  if (sentences.length < 1) return { ok: false, error: "invalid-input" };
  if (sentences.length > maxSentences) {
    return { ok: false, error: "too-long", ...counts, sentences: sentences.length };
  }
  return { ok: true, title: trimmedTitle, sentences };
}

function wrapSentence(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > maxSentenceChars) {
    const window = rest.slice(0, maxSentenceChars);
    const comma = window.lastIndexOf(",");
    const space = window.lastIndexOf(" ");
    let cut = Math.max(comma, space);
    if (cut < 200) cut = maxSentenceChars;
    else if (rest[cut] === ",") cut += 1;
    const piece = rest.slice(0, cut).trim();
    if (piece.length === 0) break;
    parts.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}
