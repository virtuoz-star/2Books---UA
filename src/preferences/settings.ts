import { defaultInterfaceLocale, defaultNativeLanguage } from "#/i18n/locale";
import { isLocale, isNativeLanguage, type Locale, type NativeLanguage } from "#/i18n/types";

export const SETTINGS_STORAGE_KEY = "2books.settings";

export type ReaderSettings = {
  interfaceLocale: Locale;
  nativeLanguage: NativeLanguage;
};

function browserDefaults(browserLanguages: readonly string[]): ReaderSettings {
  return {
    interfaceLocale: defaultInterfaceLocale(browserLanguages),
    nativeLanguage: defaultNativeLanguage(browserLanguages),
  };
}

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSettings(
  storage: { getItem(key: string): string | null } | null,
  browserLanguages: readonly string[],
): ReaderSettings {
  const defaults = browserDefaults(browserLanguages);
  if (storage === null) return defaults;

  let raw: string | null;
  try {
    raw = storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return defaults;
  }
  if (raw === null || raw === "") return defaults;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!isSettingsRecord(parsed)) return defaults;

  return {
    interfaceLocale: isLocale(parsed.interfaceLocale)
      ? parsed.interfaceLocale
      : defaults.interfaceLocale,
    nativeLanguage: isNativeLanguage(parsed.nativeLanguage)
      ? parsed.nativeLanguage
      : defaults.nativeLanguage,
  };
}

export function writeSettings(
  storage: { setItem(key: string, value: string): void } | null,
  settings: ReaderSettings,
): void {
  if (storage === null) return;
  const value = JSON.stringify({
    interfaceLocale: settings.interfaceLocale,
    nativeLanguage: settings.nativeLanguage,
  });
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, value);
  } catch {
    return;
  }
}
