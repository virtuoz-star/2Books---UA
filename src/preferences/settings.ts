import { defaultInterfaceLocale, defaultNativeLanguage } from "#/i18n/locale";
import { isLocale, isNativeLanguage, type Locale, type NativeLanguage } from "#/i18n/types";

export const SETTINGS_STORAGE_KEY = "2books.settings";
export const SETTINGS_COOKIE = "2books.settings";

export const readingFonts = ["literary", "plain", "classic"] as const;
export const readingSizes = ["small", "regular", "large"] as const;
export const readingPapers = ["auto", "lagoon", "ivory", "night"] as const;
export const translationModes = ["tap", "side", "blur"] as const;

export type ReadingFont = (typeof readingFonts)[number];
export type ReadingSize = (typeof readingSizes)[number];
export type ReadingPaper = (typeof readingPapers)[number];
export type TranslationMode = (typeof translationModes)[number];

export const defaultReadingFont: ReadingFont = "literary";
export const defaultReadingSize: ReadingSize = "regular";
export const defaultReadingPaper: ReadingPaper = "auto";
export const defaultTranslationMode: TranslationMode = "tap";

export type ReaderSettings = {
  interfaceLocale: Locale;
  nativeLanguage: NativeLanguage;
  readingFont: ReadingFont;
  readingSize: ReadingSize;
  readingPaper: ReadingPaper;
  translationMode: TranslationMode;
  hintSeen: boolean;
};

export const fallbackReaderSettings: ReaderSettings = Object.freeze({
  interfaceLocale: "uk",
  nativeLanguage: "uk",
  readingFont: defaultReadingFont,
  readingSize: defaultReadingSize,
  readingPaper: defaultReadingPaper,
  translationMode: defaultTranslationMode,
  hintSeen: false,
});

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return values.some((item) => item === value);
}

function browserDefaults(browserLanguages: readonly string[]): ReaderSettings {
  return {
    interfaceLocale: defaultInterfaceLocale(browserLanguages),
    nativeLanguage: defaultNativeLanguage(browserLanguages),
    readingFont: defaultReadingFont,
    readingSize: defaultReadingSize,
    readingPaper: defaultReadingPaper,
    translationMode: defaultTranslationMode,
    hintSeen: false,
  };
}

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function settingsPayload(settings: ReaderSettings): ReaderSettings {
  return {
    interfaceLocale: settings.interfaceLocale,
    nativeLanguage: settings.nativeLanguage,
    readingFont: settings.readingFont,
    readingSize: settings.readingSize,
    readingPaper: settings.readingPaper,
    translationMode: settings.translationMode,
    hintSeen: settings.hintSeen === true,
  };
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
    readingFont: isOneOf(readingFonts, parsed.readingFont)
      ? parsed.readingFont
      : defaults.readingFont,
    readingSize: isOneOf(readingSizes, parsed.readingSize)
      ? parsed.readingSize
      : defaults.readingSize,
    readingPaper: isOneOf(readingPapers, parsed.readingPaper)
      ? parsed.readingPaper
      : defaults.readingPaper,
    translationMode: isOneOf(translationModes, parsed.translationMode)
      ? parsed.translationMode
      : defaults.translationMode,
    hintSeen: parsed.hintSeen === true,
  };
}

export function writeSettings(
  storage: { setItem(key: string, value: string): void } | null,
  settings: ReaderSettings,
): void {
  if (storage === null) return;
  const value = JSON.stringify(settingsPayload(settings));
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, value);
  } catch {
    return;
  }
}

function cookiePair(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return trimmed.slice(eq + 1);
  }
  return null;
}

/** Reads the settings cookie. A missing cookie uses the language list, not a saved paper. */
export function readSettingsFromCookie(
  cookieHeader: string | null,
  browserLanguages: readonly string[],
): ReaderSettings {
  if (cookieHeader === null || cookieHeader === "") return readSettings(null, browserLanguages);
  const raw = cookiePair(cookieHeader, SETTINGS_COOKIE);
  if (raw === null || raw === "") return readSettings(null, browserLanguages);
  let json = raw;
  try {
    json = decodeURIComponent(raw);
  } catch {
    json = raw;
  }
  return readSettings(
    {
      getItem(key: string) {
        return key === SETTINGS_STORAGE_KEY ? json : null;
      },
    },
    browserLanguages,
  );
}

export function settingsCookieAssignment(settings: ReaderSettings): string {
  const value = encodeURIComponent(JSON.stringify(settingsPayload(settings)));
  return `${SETTINGS_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
