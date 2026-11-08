import type { Locale, NativeLanguage } from "#/i18n/types";

function primarySubtag(browserLanguages: readonly string[]): string {
  const first = browserLanguages[0] ?? "";
  if (first.length === 0) return "";
  const separator = first.indexOf("-");
  const primary = separator === -1 ? first : first.slice(0, separator);
  return primary.toLowerCase();
}

export function defaultInterfaceLocale(browserLanguages: readonly string[]): Locale {
  const primary = primarySubtag(browserLanguages);
  if (primary === "ru" || primary === "en") return primary;
  return "uk";
}

export function defaultNativeLanguage(browserLanguages: readonly string[]): NativeLanguage {
  const primary = primarySubtag(browserLanguages);
  if (primary === "ru") return "ru";
  return "uk";
}
