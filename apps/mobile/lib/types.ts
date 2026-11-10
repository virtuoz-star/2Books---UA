export type Locale = "uk" | "ru" | "en";
export type NativeLanguage = "uk" | "ru";

export const interfaceLocales = ["uk", "ru", "en"] as const satisfies readonly Locale[];
export const nativeLanguages = ["uk", "ru"] as const satisfies readonly NativeLanguage[];

export type BookTitle = Record<Locale, string>;

export type BookSummary = {
  id: string;
  author: string;
  title: BookTitle;
  chapterCount: number;
};

export type Sentence = {
  id: string;
  en: string;
  uk: string;
  ru: string;
  paragraph?: number;
};

export type Chapter = {
  id: string;
  title: BookTitle;
  sentences: Sentence[];
};

export type BookDetail = {
  id: string;
  author: string;
  title: BookTitle;
  chapters: Chapter[];
};

export const readingFonts = ["literary", "plain", "classic"] as const;
export const readingSizes = ["small", "regular", "large"] as const;
export const readingPapers = ["auto", "lagoon", "ivory", "night"] as const;

export type ReadingFont = (typeof readingFonts)[number];
export type ReadingSize = (typeof readingSizes)[number];
export type ReadingPaper = (typeof readingPapers)[number];

export type ReaderSettings = {
  interfaceLocale: Locale;
  nativeLanguage: NativeLanguage;
  readingFont: ReadingFont;
  readingSize: ReadingSize;
  readingPaper: ReadingPaper;
  hintSeen: boolean;
  wordHintSeen: boolean;
};

export function isLocale(value: unknown): value is Locale {
  return value === "uk" || value === "ru" || value === "en";
}

export function isNativeLanguage(value: unknown): value is NativeLanguage {
  return value === "uk" || value === "ru";
}
