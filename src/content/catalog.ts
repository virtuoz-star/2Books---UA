import { giftOfTheMagi } from "#/content/gift-of-the-magi";
import type { Sentence } from "#/content/passage";
import type { Locale } from "#/i18n/types";

export type Chapter = {
  id: string;
  title: Record<Locale, string>;
  sentences: Sentence[];
};

export type Book = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  chapters: Chapter[];
};

export type TranslationCode = "uk" | "ru";

export type BookSummary = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  chapterCount: number;
  sentenceCount: number;
  languages: TranslationCode[];
};

export const catalogBooks: readonly Book[] = [giftOfTheMagi];

export function translationLanguages(book: Book): TranslationCode[] {
  let ukrainian = false;
  let russian = false;
  for (const chapter of book.chapters) {
    for (const sentence of chapter.sentences) {
      if (!ukrainian && sentence.uk.trim() !== "") ukrainian = true;
      if (!russian && sentence.ru.trim() !== "") russian = true;
    }
  }
  const languages: TranslationCode[] = [];
  if (ukrainian) languages.push("uk");
  if (russian) languages.push("ru");
  return languages;
}

export function bookSummary(book: Book): BookSummary {
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
    sentenceCount: book.chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0),
    languages: translationLanguages(book),
  };
}

export function getCatalogBook(id: string): Book | null {
  return catalogBooks.find((book) => book.id === id) ?? null;
}
