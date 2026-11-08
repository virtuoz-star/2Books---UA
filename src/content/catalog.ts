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

export type BookSummary = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  chapterCount: number;
};

export const catalogBooks: readonly Book[] = [giftOfTheMagi];

export function bookSummary(book: Book): BookSummary {
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
  };
}

export function getCatalogBook(id: string): Book | null {
  return catalogBooks.find((book) => book.id === id) ?? null;
}
