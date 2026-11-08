export type Locale = "uk" | "ru" | "en";
export type NativeLanguage = "uk" | "ru";

export function isLocale(value: unknown): value is Locale {
  return value === "uk" || value === "ru" || value === "en";
}

export function isNativeLanguage(value: unknown): value is NativeLanguage {
  return value === "uk" || value === "ru";
}
