import { createFileRoute, notFound } from "@tanstack/react-router";

import { documentTitle, message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";
import { loadReaderChapter } from "#/library/api";
import { ReaderScreen } from "#/reader/reader-screen";
import { RoutePending } from "#/routes/-status-pages";
import { useNativeLanguage } from "#/shell/app-header";

function localized(value: string | Record<Locale, string>, locale: Locale): string {
  if (typeof value === "string") return value;
  return value[locale];
}

export const Route = createFileRoute("/books/$bookId/$chapterId")({
  staleTime: 5 * 60 * 1000,
  validateSearch: (search: Record<string, unknown>): { sentence?: string } => {
    const sentence = search.sentence;
    if (typeof sentence !== "string") return {};
    const trimmed = sentence.trim();
    if (trimmed.length < 1 || trimmed.length > 80 || !/^[\w.-]+$/.test(trimmed)) return {};
    return { sentence: trimmed };
  },
  loader: async ({ params }) => {
    const result = await loadReaderChapter({
      data: { bookId: params.bookId, chapterId: params.chapterId },
    });
    if (result.status === "unavailable") throw new Error("chapter unavailable");
    if (result.status !== "ok") throw notFound();
    return result;
  },
  head: ({ loaderData, match }) => {
    const locale = match.context.settings.interfaceLocale;
    if (!loaderData) return { meta: [{ title: documentTitle(message(locale, "loading")) }] };
    const bookTitle = localized(loaderData.book.title, locale);
    const chapter = loaderData.book.chapters.find((item) => item.id === match.params.chapterId);
    const part = chapter ? localized(chapter.title, locale) : bookTitle;
    return { meta: [{ title: documentTitle(`${bookTitle} — ${part}`) }] };
  },
  pendingComponent: RoutePending,
  component: ChapterPage,
});

function ChapterPage() {
  const { book, progress, upload } = Route.useLoaderData();
  const { bookId, chapterId } = Route.useParams();
  const { sentence } = Route.useSearch();
  const { user } = Route.useRouteContext();
  const nativeLanguage = useNativeLanguage();
  return (
    <ReaderScreen
      bookId={bookId}
      book={book}
      chapterId={chapterId}
      nativeLanguage={nativeLanguage}
      signedIn={user !== null}
      progress={progress}
      linkedSentence={sentence ?? null}
      upload={upload}
    />
  );
}
