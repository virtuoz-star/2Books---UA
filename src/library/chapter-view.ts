import type { Book } from "#/content/catalog";

// Other chapters keep their titles for the part list and drop their sentences.
export function chapterView(book: Book, chapterId: string): Book | null {
  const index = book.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index < 0) return null;
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    chapters: book.chapters.map((chapter, chapterIndex) =>
      chapterIndex === index ? chapter : { id: chapter.id, title: chapter.title, sentences: [] },
    ),
  };
}
