import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Button } from "#/components/ui/button";
import { EmptyState } from "#/components/ui/empty-state";
import { Field, Input, Select } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { PageHeader } from "#/components/ui/page-header";
import { Toast, ToastProvider } from "#/components/ui/toast";
import { GoogleKeyForm } from "#/dictionary/google-key-form";
import { FlashcardsPanel } from "#/dictionary/flashcards-panel";
import type { FlashCard } from "#/dictionary/flashcards";
import { savedWordKey, type SavedWord } from "#/dictionary/saved-words";
import { useSavedWords } from "#/dictionary/use-saved-words";
import { flushWordSync } from "#/dictionary/word-sync";
import { documentTitle, exportedAnki, message, wordCountLabel } from "#/i18n/messages";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { useNativeLanguage } from "#/shell/app-header";
import { ReadingLanguageContext } from "#/shell/reading-language";
import { useContext } from "react";

export const Route = createFileRoute("/words")({
  head: ({ match }) => ({
    meta: [
      {
        title: documentTitle(message(match.context.settings.interfaceLocale, "savedWords")),
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { practice?: boolean; only?: string } => {
    const practice = search.practice === true || search.practice === "1" || search.practice === 1;
    const only =
      typeof search.only === "string" && search.only.length > 0 && search.only.length <= 8_000
        ? search.only
        : undefined;
    return {
      ...(practice ? { practice: true } : {}),
      ...(only ? { only } : {}),
    };
  },
  component: WordsPage,
});

function downloadAnki(text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "2books-words.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
}

function emphasize(sentence: string, word: string) {
  const index = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0) return sentence;
  return (
    <>
      {sentence.slice(0, index)}
      <strong>{sentence.slice(index, index + word.length)}</strong>
      {sentence.slice(index + word.length)}
    </>
  );
}

function WordsPage() {
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const nativeLanguage = useNativeLanguage();
  const reading = useContext(ReadingLanguageContext);
  const search = Route.useSearch();
  const { words, ready, syncFailed, deviceError, remove, restore, ankiDeck } = useSavedWords();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "alpha">("recent");
  const [undo, setUndo] = useState<SavedWord | null>(null);
  const [exported, setExported] = useState<number | null>(null);
  const [practicing, setPracticing] = useState(search.practice === true);
  const visible = words.filter((word) => word.nativeLanguage === nativeLanguage);
  const other = nativeLanguage === "uk" ? "ru" : "uk";
  const otherCount = words.filter((word) => word.nativeLanguage === other).length;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? visible.filter((word) =>
          [word.word, word.gloss, word.sentenceEn, word.sentenceNative].some((part) =>
            part.toLowerCase().includes(needle),
          ),
        )
      : visible;
    return [...matched].sort((left, right) =>
      sort === "alpha" ? left.word.localeCompare(right.word) : right.savedAt - left.savedAt,
    );
  }, [query, sort, visible]);
  const cards: FlashCard[] = visible.map((word) => ({
    id: savedWordKey(word.word, word.nativeLanguage) ?? `${word.nativeLanguage}:${word.word}`,
    word: word.word,
    gloss: word.gloss,
    sentenceEn: word.sentenceEn,
    sentenceNative: word.sentenceNative,
  }));
  const onlyKeys = useMemo(() => {
    if (!search.only) return null;
    const keys = search.only.split(",").filter((item) => item.length > 0);
    return keys.length > 0 ? new Set(keys) : null;
  }, [search.only]);
  const partCards = onlyKeys === null ? cards : cards.filter((card) => onlyKeys.has(card.id));
  const [fromPart, setFromPart] = useState(onlyKeys !== null);

  useEffect(() => {
    flushWordSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") flushWordSync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (search.practice) setPracticing(true);
  }, [search.practice]);

  return (
    <ToastProvider>
      <div className="flex flex-col gap-6">
        <PageHeader title={`${message(locale, "savedWords")} · ${wordCountLabel(locale, visible.length)}`}>
          <p className="text-sm text-muted-foreground">{message(locale, "wordsLead")}</p>
        </PageHeader>
        {syncFailed ? (
          <Notice tone="danger">
            <span className="flex flex-wrap items-center gap-3">
              {message(locale, "syncFailed")}
              <Button type="button" variant="secondary" onClick={() => flushWordSync()}>
                {message(locale, "retryAction")}
              </Button>
            </span>
          </Notice>
        ) : null}
        {deviceError ? <Notice tone="danger">{message(locale, "couldNotSave")}</Notice> : null}
        {practicing && (fromPart ? partCards : cards).length > 0 ? (
          <FlashcardsPanel
            locale={locale}
            nativeLanguage={nativeLanguage}
            cards={fromPart ? partCards : cards}
            onLeave={() => {
              setFromPart(false);
              setPracticing(false);
            }}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <Field id="words-search" label={message(locale, "wordsSearch")} className="min-w-48 flex-1">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} />
              </Field>
              <Field id="words-sort" label={message(locale, "wordsRecent")}>
                <Select
                  value={sort}
                  onChange={(event) => setSort(event.target.value === "alpha" ? "alpha" : "recent")}
                >
                  <option value="recent">{message(locale, "wordsRecent")}</option>
                  <option value="alpha">{message(locale, "wordsAlpha")}</option>
                </Select>
              </Field>
              <Button
                type="button"
                disabled={!ready || visible.length === 0}
                onClick={() => {
                  setFromPart(false);
                  setPracticing(true);
                }}
              >
                {message(locale, "practice")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!ready || filtered.length === 0}
                onClick={() => {
                  downloadAnki(ankiDeck(filtered));
                  setExported(filtered.length);
                }}
              >
                {message(locale, "exportAnki")}
              </Button>
            </div>
            {exported !== null ? (
              <Notice tone="success">
                {exportedAnki(locale, exported)} {message(locale, "ankiHint")}
              </Notice>
            ) : null}
            {ready && visible.length === 0 && otherCount > 0 ? (
              <EmptyState>
                {message(locale, "wordsOther")}{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => reading?.setNativeLanguage(other)}
                >
                  {message(locale, "switchLanguage")}
                </Button>
              </EmptyState>
            ) : null}
            {ready && words.length === 0 ? (
              <EmptyState>
                {message(locale, "wordsEmpty")}{" "}
                <Link to="/" className="text-primary underline">
                  {message(locale, "readABook")}
                </Link>
              </EmptyState>
            ) : null}
            <ul className="m-0 list-none p-0">
              {filtered.map((word) => (
                <li
                  key={`${word.nativeLanguage}:${word.word}`}
                  className="flex flex-col gap-1 border-b border-border py-4"
                >
                  <p lang="en" className="text-lg font-medium text-foreground">
                    {word.word}
                  </p>
                  {word.gloss === "" ? null : (
                    <p lang={nativeLanguage} className="text-foreground">
                      {word.gloss}
                    </p>
                  )}
                  {word.sentenceEn === "" ? null : (
                    <p lang="en" className="text-sm text-foreground">
                      {emphasize(word.sentenceEn, word.word)}
                    </p>
                  )}
                  {word.sentenceNative === "" ? null : (
                    <p lang={nativeLanguage} className="text-sm text-muted-foreground">
                      {word.sentenceNative}
                    </p>
                  )}
                  {word.bookSource === "catalog" && word.bookId !== "" ? (
                    <Link
                      to="/books/$bookId/$chapterId"
                      params={{ bookId: word.bookId, chapterId: word.chapterId }}
                      search={{ sentence: word.sentenceId }}
                      className="text-sm text-primary underline"
                    >
                      {message(locale, "openInBook")}
                    </Link>
                  ) : null}
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      const snapshot = word;
                      if (remove(word.word, nativeLanguage)) setUndo(snapshot);
                    }}
                  >
                    {message(locale, "removeWord")}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
        <section className="border-t border-border pt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">{message(locale, "googleKeyLabel")}</h2>
          <GoogleKeyForm locale={locale} />
        </section>
      </div>
      <Toast
        open={undo !== null}
        onOpenChange={(open) => {
          if (!open) setUndo(null);
        }}
        title={message(locale, "wordRemovedStatus")}
        undoLabel={message(locale, "undoAction")}
        closeLabel={message(locale, "closePanel")}
        onUndo={() => {
          if (undo === null) return;
          restore(undo);
          setUndo(null);
        }}
      />
    </ToastProvider>
  );
}
