import { partLabel } from "@/lib/messages";
import type { BookTitle, Locale } from "@/lib/types";

export function displayTitle(title: BookTitle, locale: Locale): string {
  if (title[locale].trim() !== "") return title[locale];
  if (title.en.trim() !== "") return title.en;
  if (title.uk.trim() !== "") return title.uk;
  if (title.ru.trim() !== "") return title.ru;
  return "";
}

export function chapterLabel(title: BookTitle, index: number, locale: Locale): string {
  const text = displayTitle(title, locale);
  if (text.trim() !== "") return text;
  return partLabel(locale, index + 1);
}
