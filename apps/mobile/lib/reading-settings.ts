import {
  isLocale,
  isNativeLanguage,
  readingFonts,
  readingPapers,
  readingSizes,
  type ReaderSettings,
} from "@/lib/types";

const readingDefaults = {
  readingFont: "literary",
  readingSize: "regular",
  readingPaper: "auto",
  hintSeen: false,
  wordHintSeen: false,
} as const satisfies Omit<ReaderSettings, "interfaceLocale" | "nativeLanguage">;

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && options.some((option) => option === value);
}

export function parseStoredSettings(raw: string): ReaderSettings | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (!isLocale(record.interfaceLocale) || !isNativeLanguage(record.nativeLanguage)) return null;
    return {
      interfaceLocale: record.interfaceLocale,
      nativeLanguage: record.nativeLanguage,
      readingFont: isOneOf(readingFonts, record.readingFont)
        ? record.readingFont
        : readingDefaults.readingFont,
      readingSize: isOneOf(readingSizes, record.readingSize)
        ? record.readingSize
        : readingDefaults.readingSize,
      readingPaper: isOneOf(readingPapers, record.readingPaper)
        ? record.readingPaper
        : readingDefaults.readingPaper,
      hintSeen: record.hintSeen === true,
      wordHintSeen: record.wordHintSeen === true,
    };
  } catch {
    return null;
  }
}

export function serializeSettings(settings: ReaderSettings): string {
  return JSON.stringify({
    interfaceLocale: settings.interfaceLocale,
    nativeLanguage: settings.nativeLanguage,
    readingFont: settings.readingFont,
    readingSize: settings.readingSize,
    readingPaper: settings.readingPaper,
    hintSeen: settings.hintSeen,
    wordHintSeen: settings.wordHintSeen,
  });
}
