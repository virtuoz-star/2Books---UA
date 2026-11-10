import { message } from "@/lib/messages";
import type { Locale, NativeLanguage, Sentence } from "@/lib/types";

/** Text stored on a saved word. Empty stays empty; the placeholder is display-only. */
export function storedSentenceNative(
  sentence: Pick<Sentence, "uk" | "ru">,
  native: NativeLanguage,
): string {
  return sentence[native];
}

export function nativeLine(
  sentence: Pick<Sentence, "uk" | "ru">,
  native: NativeLanguage,
  locale: Locale,
): string {
  if (sentence[native] !== "") return sentence[native];
  const other = native === "uk" ? sentence.ru : sentence.uk;
  if (other !== "") return other;
  return message(locale, "noTranslation");
}
