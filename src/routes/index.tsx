import { Link, createFileRoute, isNotFound, isRedirect } from "@tanstack/react-router";

import { bookSummary, catalogBooks } from "#/content/catalog";
import { message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";
import { loadLibraryHome } from "#/library/api";
import { useReaderSettings } from "#/reader/use-reader-settings";

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      return await loadLibraryHome();
    } catch (error) {
      if (isRedirect(error) || isNotFound(error)) throw error;
      return null;
    }
  },
  component: CatalogPage,
});

function chapterFor(
  bookId: string,
  progress: { bookId: string; chapterId: string } | null,
): string {
  if (progress !== null && progress.bookId === bookId && progress.chapterId !== "") {
    return progress.chapterId;
  }
  return "c1";
}

function titleText(title: string | Record<Locale, string>, locale: Locale): string {
  if (typeof title === "string") return title;
  return title[locale];
}

function CatalogPage() {
  const home = Route.useLoaderData();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const progress = home?.progress ?? null;
  const myBooks = home?.user ? home.myBooks : null;

  return (
    <main lang={locale} className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="display-title text-4xl font-medium leading-tight text-foreground">
          {message(locale, "catalogHeading")}
        </h1>
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {catalogBooks.map((book) => {
            const summary = bookSummary(book);
            const chapterId = chapterFor(summary.id, progress);
            const continuing = progress !== null && progress.bookId === summary.id;
            return (
              <li
                key={summary.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              >
                <h2 className="display-title text-3xl font-medium leading-tight text-foreground">
                  {titleText(summary.title, locale)}
                </h2>
                <p className="text-base text-muted-foreground">{summary.author}</p>
                <Link
                  to="/books/$bookId/$chapterId"
                  params={{ bookId: summary.id, chapterId }}
                  className="w-fit text-sm font-medium text-foreground"
                >
                  {message(locale, continuing ? "continueReading" : "openBook")}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      {myBooks !== null ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">{message(locale, "myBooks")}</h2>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {myBooks.map((book) => {
              const chapterId = chapterFor(book.id, progress);
              const continuing = progress !== null && progress.bookId === book.id;
              return (
                <li
                  key={book.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                >
                  <h3 className="display-title text-3xl font-medium leading-tight text-foreground">
                    {titleText(book.title, locale)}
                  </h3>
                  {book.author ? (
                    <p className="text-base text-muted-foreground">{book.author}</p>
                  ) : null}
                  {book.alignmentPending ? (
                    <p className="text-sm text-muted-foreground">
                      {message(locale, "alignmentPending")}
                    </p>
                  ) : null}
                  <Link
                    to="/books/$bookId/$chapterId"
                    params={{ bookId: book.id, chapterId }}
                    className="w-fit text-sm font-medium text-foreground"
                  >
                    {message(locale, continuing ? "continueReading" : "openBook")}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
