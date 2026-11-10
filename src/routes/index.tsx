import { Link, createFileRoute, isNotFound, isRedirect, useRouter } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { EmptyState } from "#/components/ui/empty-state";
import { Field, Input } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { PageHeader } from "#/components/ui/page-header";
import { ProgressBar } from "#/components/ui/progress-bar";
import { TranslateJobStatus } from "#/components/translate-job-status";
import { bookSummary, catalogBooks, type TranslationCode } from "#/content/catalog";
import { readGoogleTranslateKey } from "#/dictionary/google-key";
import {
  noticeFromUpload,
  translateOwnedUpload,
  type OwnedUploadNotice,
} from "#/dictionary/translate-upload";
import {
  documentTitle,
  languageName,
  message,
  partLabel,
  partsMeta,
  readingTimeLabel,
} from "#/i18n/messages";
import type { Locale } from "#/i18n/types";
import { deleteMyBook, loadLibraryHome, renameMyBook } from "#/library/api";
import { mergeProgress, readProgressList, type LocalProgress } from "#/reader/progress";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { useNativeLanguage } from "#/shell/app-header";

export const Route = createFileRoute("/")({
  staleTime: 0,
  head: ({ match }) => ({
    meta: [
      {
        title: documentTitle(message(match.context.settings.interfaceLocale, "catalogHeading")),
      },
    ],
  }),
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

function chapterNumber(chapterId: string): number {
  const match = /^c(\d+)$/.exec(chapterId);
  if (!match) return 1;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function barFor(
  chapterId: string,
  chapterCount: number | null,
  locale: Locale,
): { value: number; max: number; label: string } {
  const n = chapterNumber(chapterId);
  if (chapterCount !== null && chapterCount > 0) {
    return { value: n, max: chapterCount, label: partLabel(locale, n, chapterCount) };
  }
  return { value: n, max: n + 1, label: partLabel(locale, n, null) };
}

function titleText(title: string | Record<Locale, string>, locale: Locale): string {
  if (typeof title === "string") return title;
  return title[locale];
}

type UploadJob = {
  running: boolean;
  progress: { done: number; total: number } | null;
  notice: OwnedUploadNotice | null;
};

function CatalogPage() {
  const home = Route.useLoaderData();
  const router = useRouter();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const nativeLanguage = useNativeLanguage();
  const myBooks = home?.user ? home.myBooks : null;
  const summaries = home?.catalog ?? catalogBooks.map((book) => bookSummary(book));
  const seenHome = useRef(home);
  const [alignmentOverlay, setAlignmentOverlay] = useState<Record<string, "pending" | "ready">>({});
  const [jobs, setJobs] = useState<Record<string, UploadJob>>({});
  const [localRows, setLocalRows] = useState<LocalProgress[]>([]);
  const aborts = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const controllers = aborts.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, []);

  const jobRunning = Object.values(jobs).some((job) => job.running);
  useEffect(() => {
    if (!jobRunning) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [jobRunning]);

  useEffect(() => {
    if (home === seenHome.current) return;
    seenHome.current = home;
    const books = home?.user ? home.myBooks : [];
    setAlignmentOverlay((current) => {
      const next: Record<string, "pending" | "ready"> = {};
      for (const [id, saved] of Object.entries(current)) {
        const book = books.find((item) => item.id === id);
        if (!book) continue;
        if (book.alignmentPending === (saved !== "ready")) continue;
        next[id] = saved;
      }
      return next;
    });
  }, [home]);

  useEffect(() => {
    setLocalRows(readProgressList(window.localStorage));
  }, [home]);

  const startUpload = (bookId: string, again: boolean) => {
    const job = jobs[bookId];
    if (job?.running) return;
    const key = readGoogleTranslateKey();
    if (key.length === 0) {
      setJobs((current) => ({
        ...current,
        [bookId]: { running: false, progress: null, notice: { kind: "need-key" } },
      }));
      return;
    }
    const controller = new AbortController();
    aborts.current.get(bookId)?.abort();
    aborts.current.set(bookId, controller);
    setJobs((current) => ({
      ...current,
      [bookId]: { running: true, progress: null, notice: null },
    }));
    void translateOwnedUpload({
      bookId,
      again,
      key,
      signal: controller.signal,
      onProgress: (done, total) => {
        if (controller.signal.aborted || total < 1) return;
        setJobs((current) => ({
          ...current,
          [bookId]: {
            running: true,
            progress: { done, total },
            notice: current[bookId]?.notice ?? null,
          },
        }));
      },
    }).then((result) => {
      if (controller.signal.aborted) return;
      setJobs((current) => ({
        ...current,
        [bookId]: { running: false, progress: null, notice: noticeFromUpload(result) },
      }));
      if (!result.ok) return;
      setAlignmentOverlay((current) => ({ ...current, [bookId]: result.alignment }));
      void router.invalidate({ filter: (match) => match.routeId === "/" });
    });
  };

  const progressRows = mergeProgress(localRows, home?.progressByBook ?? []);
  const progressByBook = new Map(progressRows.map((row) => [row.bookId, row]));
  const newest = progressRows[0] ?? null;
  const continueBook = (() => {
    if (newest === null) return null;
    const catalog = summaries.find((book) => book.id === newest.bookId);
    if (catalog) {
      return {
        title: titleText(catalog.title, locale),
        chapterCount: catalog.chapterCount,
      };
    }
    const mine = myBooks?.find((book) => book.id === newest.bookId);
    if (!mine) return null;
    return { title: titleText(mine.title, locale), chapterCount: mine.chapterCount || null };
  })();

  const [onlyMine, setOnlyMine] = useState(false);
  const shelf = onlyMine
    ? summaries.filter((book) => book.languages.includes(nativeLanguage))
    : [...summaries].sort((left, right) => {
        const leftHit = left.languages.includes(nativeLanguage) ? 0 : 1;
        const rightHit = right.languages.includes(nativeLanguage) ? 0 : 1;
        return leftHit - rightHit;
      });
  const failed = home === null || home.degraded;

  return (
    <div className="flex flex-col gap-10">
      {home && !home.user && !home.degraded ? (
        <p className="max-w-xl text-base text-muted-foreground">{message(locale, "appDescription")}</p>
      ) : null}
      {failed ? (
        <Notice tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            {message(locale, "libraryFailed")}
            <Button type="button" variant="secondary" onClick={() => void router.invalidate()}>
              {message(locale, "retryAction")}
            </Button>
          </span>
        </Notice>
      ) : null}
      {continueBook && newest ? (
        <Link
          to="/books/$bookId/$chapterId"
          params={{
            bookId: newest.bookId,
            chapterId: newest.chapterId !== "" ? newest.chapterId : "c1",
          }}
          className="no-underline"
        >
          <Card className="gap-3 bg-card">
            <p className="text-sm text-muted-foreground">{message(locale, "continueReading")}</p>
            <h2 className="display-title text-2xl leading-tight text-foreground">{continueBook.title}</h2>
            <ProgressBar {...barFor(newest.chapterId, continueBook.chapterCount, locale)} />
            <span className="text-sm font-medium text-primary">{message(locale, "continueReading")}</span>
          </Card>
        </Link>
      ) : null}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeader title={message(locale, "catalogHeading")} />
          <Button type="button" variant={onlyMine ? "primary" : "secondary"} onClick={() => setOnlyMine((value) => !value)}>
            {message(locale, "filterLanguage")}
          </Button>
        </div>
        <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {shelf.map((summary) => {
            const row = progressByBook.get(summary.id) ?? null;
            const chapterId = row && row.chapterId !== "" ? row.chapterId : "c1";
            return (
              <BookCard
                key={summary.id}
                title={titleText(summary.title, locale)}
                author={summary.author}
                bookId={summary.id}
                chapterId={chapterId}
                action={message(locale, row ? "continueReading" : "openBook")}
                parts={partsMeta(locale, summary.chapterCount)}
                minutes={readingTimeLabel(locale, readingMinutes(summary.sentenceCount))}
                languages={summary.languages}
                locale={locale}
                progress={row ? barFor(row.chapterId, summary.chapterCount, locale) : null}
                download={{
                  href: `/api/books/${summary.id}/download?lang=${nativeLanguage}`,
                  label: message(locale, "downloadBook"),
                }}
              />
            );
          })}
        </ul>
      </section>
      {myBooks !== null ? (
        <section>
          <h2 className="display-title text-2xl text-foreground">{message(locale, "myBooks")}</h2>
          {myBooks.length === 0 ? (
            <EmptyState>
              {message(locale, "myTextsEmpty")}{" "}
              <Link to="/upload" className="text-primary underline">
                {message(locale, "navAdd")}
              </Link>
            </EmptyState>
          ) : null}
          <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
            {myBooks.map((book) => {
              const row = progressByBook.get(book.id) ?? null;
              const chapterId = row && row.chapterId !== "" ? row.chapterId : "c1";
              const savedAlignment = alignmentOverlay[book.id];
              const pending =
                savedAlignment !== undefined ? savedAlignment !== "ready" : book.alignmentPending;
              const job = jobs[book.id];
              return (
                <BookCard
                  key={book.id}
                  title={titleText(book.title, locale)}
                  author={book.author}
                  note={pending ? message(locale, "alignmentPending") : null}
                  bookId={book.id}
                  chapterId={chapterId}
                  action={message(locale, row ? "continueReading" : "openBook")}
                  parts={partsMeta(locale, book.chapterCount || 1)}
                  minutes={readingTimeLabel(locale, readingMinutes(book.sentenceCount))}
                  languages={book.languages}
                  locale={locale}
                  progress={row ? barFor(row.chapterId, book.chapterCount || null, locale) : null}
                  owned
                  onChanged={() => {
                    void router.invalidate({ filter: (match) => match.routeId === "/" });
                  }}
                  extra={
                    <TranslateJobStatus
                      className="pointer-events-auto relative z-10 mt-2"
                      locale={locale}
                      again={!pending}
                      running={job?.running ?? false}
                      progress={job?.progress ?? null}
                      notice={job?.notice ?? null}
                      onStart={() => {
                        startUpload(book.id, !pending);
                      }}
                      onCancel={() => {
                        aborts.current.get(book.id)?.abort();
                        setJobs((current) => ({
                          ...current,
                          [book.id]: { running: false, progress: null, notice: null },
                        }));
                      }}
                    />
                  }
                />
              );
            })}
            <li>
              <Link
                to="/upload"
                className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-sm font-medium text-primary no-underline"
              >
                {message(locale, "addTextTile")}
              </Link>
            </li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function readingMinutes(sentenceCount: number): number {
  if (sentenceCount < 1) return 1;
  return Math.max(1, Math.round((sentenceCount * 12) / 200));
}

const coverPapers = ["#f3ecdf", "#e7efe8", "#e7eaf3", "#f6e7e3", "#eee7f4", "#e5f0f2"];
const coverInks = ["#3c3226", "#24362c", "#243044", "#3f2a28", "#2e2840", "#1e3338"];

function coverTone(id: string): { background: string; color: string } {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const tone = (hash >>> 0) % coverPapers.length;
  return { background: coverPapers[tone] ?? "#f3ecdf", color: coverInks[tone] ?? "#3c3226" };
}

function BookCard({
  title,
  author,
  note,
  bookId,
  chapterId,
  action,
  parts,
  minutes,
  languages,
  locale,
  progress,
  download,
  owned,
  onChanged,
  extra,
}: {
  title: string;
  author: string;
  note?: string | null;
  bookId: string;
  chapterId: string;
  action: string;
  parts: string;
  minutes: string;
  languages: readonly TranslationCode[];
  locale: Locale;
  progress?: { value: number; max: number; label: string } | null;
  download?: { href: string; label: string } | null;
  owned?: boolean;
  onChanged?: () => void;
  extra?: ReactNode;
}) {
  const tone = coverTone(bookId);
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState<"rename" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    const next = draft.trim();
    if (next.length < 1 || next.length > 120) {
      setError(message(locale, "invalidInput"));
      return;
    }
    setBusy("rename");
    setError(null);
    try {
      const result = await renameMyBook({ data: { bookId, title: next } });
      if (!result.ok) {
        setError(message(locale, result.error === "invalid" ? "invalidInput" : "actionFailed"));
        return;
      }
      setMode("idle");
      onChanged?.();
    } catch {
      setError(message(locale, "actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const result = await deleteMyBook({ data: { bookId } });
      if (!result.ok) {
        setError(message(locale, "actionFailed"));
        return;
      }
      onChanged?.();
    } catch {
      setError(message(locale, "actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Link
        to="/books/$bookId/$chapterId"
        params={{ bookId, chapterId }}
        aria-label={`${action}: ${title}`}
        className="absolute inset-0 z-0 rounded-lg"
      />
      <div className="flex gap-3">
        <div
          className="display-title flex aspect-[2/3] w-16 shrink-0 items-end overflow-hidden p-1.5 text-[0.7rem] leading-tight"
          style={{ background: tone.background, color: tone.color }}
          aria-hidden
        >
          {title}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="display-title text-lg leading-tight text-foreground">{title}</h3>
          {author ? <p className="text-sm text-muted-foreground">{author}</p> : null}
          <p className="text-sm text-muted-foreground">
            {parts} · {minutes}
          </p>
          {languages.length > 0 ? (
            <p className="mt-1 flex flex-wrap gap-1">
              {languages.map((code) => (
                <span key={code} className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground">
                  {languageName(locale, code)}
                </span>
              ))}
            </p>
          ) : null}
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        </div>
      </div>
      {progress ? <ProgressBar value={progress.value} max={progress.max} label={progress.label} /> : null}
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        <span className="btn btn-primary bg-primary text-primary-foreground pointer-events-none inline-flex rounded-full px-3 py-2 text-sm font-medium">
          {action}
        </span>
        {download ? (
          <a
            href={download.href}
            aria-label={download.label}
            className="icon-btn btn btn-quiet inline-flex size-10 items-center justify-center rounded-full text-foreground"
          >
            <Download className="size-4" aria-hidden />
          </a>
        ) : null}
      </div>
      {owned ? (
        <div className="relative z-10 flex flex-col items-start gap-2">
          {mode === "rename" ? (
            <form
              className="flex w-full flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void rename();
              }}
            >
              <Field id={`rename-${bookId}`} label={message(locale, "renameBook")} className="min-w-40 flex-1">
                <Input
                  value={draft}
                  maxLength={120}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </Field>
              <Button type="submit" busy={busy === "rename"}>
                {message(locale, "renameBook")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setMode("idle")}>
                {message(locale, "cancelAction")}
              </Button>
            </form>
          ) : mode === "delete" ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-foreground">{title}</p>
              <Button type="button" variant="danger" autoFocus busy={busy === "delete"} onClick={() => void remove()}>
                {message(locale, "confirmDeletePermanent")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setMode("idle")}>
                {message(locale, "cancelAction")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft(title);
                  setMode("rename");
                }}
              >
                {message(locale, "renameBook")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setMode("delete")}>
                {message(locale, "deleteText")}
              </Button>
            </div>
          )}
          {error ? <Notice tone="danger">{error}</Notice> : null}
        </div>
      ) : null}
      {extra}
    </li>
  );
}
