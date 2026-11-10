import type { BookDetail } from "@/lib/types";

export function chapterView(book: BookDetail, openIndex: number): BookDetail {
  return {
    ...book,
    chapters: book.chapters.map((chapter, index) =>
      index === openIndex ? chapter : { ...chapter, sentences: [] },
    ),
  };
}
