import { splitEnglishSentences } from "#/library/split";

const maxTitleLength = 120;
const maxTextLength = 100_000;
const maxSentences = 200;

export function prepareUpload(
  title: string,
  text: string,
):
  | { ok: true; title: string; sentences: string[] }
  | { ok: false; error: "invalid-input" | "too-long" } {
  if (typeof title !== "string" || typeof text !== "string") {
    return { ok: false, error: "invalid-input" };
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length < 1 || trimmedTitle.length > maxTitleLength) {
    return { ok: false, error: "invalid-input" };
  }
  const trimmedText = text.trim();
  if (trimmedText.length > maxTextLength) return { ok: false, error: "too-long" };
  const sentences = splitEnglishSentences(trimmedText);
  if (sentences.length < 1) return { ok: false, error: "invalid-input" };
  if (sentences.length > maxSentences) return { ok: false, error: "too-long" };
  return { ok: true, title: trimmedTitle, sentences };
}
