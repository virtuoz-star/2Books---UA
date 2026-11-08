import type { Locale } from "@/lib/types";

export type MessageKey =
  | "appName"
  | "books"
  | "read"
  | "previousPart"
  | "nextPart"
  | "translation"
  | "hint"
  | "noTranslation"
  | "interfaceLanguage"
  | "nativeLanguage"
  | "loading"
  | "loadError"
  | "retry"
  | "emptyCatalog"
  | "emptyBook"
  | "parts";

type Catalog = Record<MessageKey | "part" | "sentenceLabel", string> & {
  language: Record<Locale, string>;
  partOne: string;
  partFew: string;
  partMany: string;
};

const catalogs = {
  uk: {
    appName: "2books",
    books: "Книги",
    read: "Читати",
    previousPart: "Попередня частина",
    nextPart: "Наступна частина",
    translation: "Переклад",
    hint: "Оберіть речення, щоб побачити переклад.",
    noTranslation: "У цього речення ще немає перекладу.",
    interfaceLanguage: "Мова інтерфейсу",
    nativeLanguage: "Мова перекладу",
    loading: "Завантаження…",
    loadError: "Не вдалося завантажити.",
    retry: "Спробувати ще раз",
    emptyCatalog: "У каталозі ще немає книжок.",
    emptyBook: "У цій книжці ще немає частин.",
    parts: "Частини",
    part: "Частина {n}",
    sentenceLabel: "Речення {n}",
    partOne: "частина",
    partFew: "частини",
    partMany: "частин",
    language: {
      uk: "Українська",
      ru: "Російська",
      en: "Англійська",
    },
  },
  ru: {
    appName: "2books",
    books: "Книги",
    read: "Читать",
    previousPart: "Предыдущая часть",
    nextPart: "Следующая часть",
    translation: "Перевод",
    hint: "Выберите предложение, чтобы увидеть перевод.",
    noTranslation: "У этого предложения ещё нет перевода.",
    interfaceLanguage: "Язык интерфейса",
    nativeLanguage: "Язык перевода",
    loading: "Загрузка…",
    loadError: "Не удалось загрузить.",
    retry: "Попробовать снова",
    emptyCatalog: "В каталоге пока нет книг.",
    emptyBook: "В этой книге пока нет частей.",
    parts: "Части",
    part: "Часть {n}",
    sentenceLabel: "Предложение {n}",
    partOne: "часть",
    partFew: "части",
    partMany: "частей",
    language: {
      uk: "Украинский",
      ru: "Русский",
      en: "Английский",
    },
  },
  en: {
    appName: "2books",
    books: "Books",
    read: "Read",
    previousPart: "Previous part",
    nextPart: "Next part",
    translation: "Translation",
    hint: "Select a sentence to see its translation.",
    noTranslation: "This sentence has no translation yet.",
    interfaceLanguage: "Interface language",
    nativeLanguage: "Translation language",
    loading: "Loading…",
    loadError: "Could not load this.",
    retry: "Try again",
    emptyCatalog: "No books yet.",
    emptyBook: "This book has no parts yet.",
    parts: "Parts",
    part: "Part {n}",
    sentenceLabel: "Sentence {n}",
    partOne: "part",
    partFew: "parts",
    partMany: "parts",
    language: {
      uk: "Ukrainian",
      ru: "Russian",
      en: "English",
    },
  },
} satisfies Record<Locale, Catalog>;

export function message(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function languageName(locale: Locale, language: Locale): string {
  return catalogs[locale].language[language];
}

export function partLabel(locale: Locale, n: number): string {
  return catalogs[locale].part.replaceAll("{n}", String(n));
}

export function sentenceLabel(locale: Locale, n: number): string {
  return catalogs[locale].sentenceLabel.replaceAll("{n}", String(n));
}

export function chapterCountLabel(locale: Locale, count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (locale === "en") {
    return n === 1 ? `${n} ${catalogs.en.partOne}` : `${n} ${catalogs.en.partMany}`;
  }
  const catalog = catalogs[locale];
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${catalog.partOne}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${catalog.partFew}`;
  return `${n} ${catalog.partMany}`;
}
