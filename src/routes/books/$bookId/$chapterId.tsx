import { createFileRoute, isNotFound, isRedirect, notFound } from "@tanstack/react-router";

import { loadLibraryHome, loadReaderBook } from "#/library/api";
import { ReaderScreen, type ReaderProgress } from "#/reader/reader-screen";
import { useNativeLanguage } from "#/shell/app-header";

export const Route = createFileRoute("/books/$bookId/$chapterId")({
  loader: async ({ params }) => {
    const book = await loadReaderBook({ data: { bookId: params.bookId } });
    if (book === null) throw notFound();
    if (!book.chapters.some((chapter: { id: string }) => chapter.id === params.chapterId)) {
      throw notFound();
    }
    let progress: ReaderProgress | null = null;
    try {
      const home = await loadLibraryHome();
      progress = home.progress;
    } catch (error) {
      if (isRedirect(error) || isNotFound(error)) throw error;
      progress = null;
    }
    return { book, progress };
  },
  component: ChapterPage,
});

function ChapterPage() {
  const { book, progress } = Route.useLoaderData();
  const { bookId, chapterId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const nativeLanguage = useNativeLanguage();
  return (
    <ReaderScreen
      bookId={bookId}
      book={book}
      chapterId={chapterId}
      progress={progress}
      nativeLanguage={nativeLanguage}
      signedIn={user !== null}
    />
  );
}
