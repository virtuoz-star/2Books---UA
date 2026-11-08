import { Link, useNavigate } from "@tanstack/react-router";
import { createElement, Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { lookupWord } from "#/dictionary/lookup";
import { message, sentenceLabel } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import { saveProgress } from "#/library/api";
import {
  clearSelection,
  selectSentence,
  selectWord,
  type SelectionState,
} from "#/reader/selection";
import { useReaderSettings } from "#/reader/use-reader-settings";

const sentenceButtonClass =
  "inline cursor-pointer appearance-none border-0 bg-transparent p-0 text-left align-baseline [font:inherit] text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring";

const selectedSentenceClass =
  "inline cursor-pointer bg-muted p-0 text-left align-baseline [font:inherit] text-inherit underline decoration-2 underline-offset-4";

const wordButtonClass =
  "inline cursor-pointer appearance-none border-0 bg-transparent p-0 text-left align-baseline [font:inherit] text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring";

const selectedWordClass =
  "inline cursor-pointer appearance-none border-0 bg-background p-0 text-left align-baseline [font:inherit] text-inherit underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring";

const dismissClass =
  "cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground";

export type ReaderSentence = {
  id: string;
  en: string;
  uk: string;
  ru: string;
};

export type ReaderChapter = {
  id: string;
  title: string | Record<Locale, string>;
  sentences: readonly ReaderSentence[];
};

export type ReaderBook = {
  id: string;
  author?: string;
  title: string | Record<Locale, string>;
  chapters: readonly ReaderChapter[];
};

export type ReaderProgress = {
  bookId: string;
  chapterId: string;
  sentenceId: string | null;
};

type SentenceToken = { kind: "word"; index: number; text: string } | { kind: "gap"; text: string };

function localized(value: string | Record<Locale, string>, locale: Locale): string {
  if (typeof value === "string") return value;
  return value[locale];
}

function sentenceTokens(text: string): SentenceToken[] {
  const tokens: SentenceToken[] = [];
  let wordIndex = 0;
  for (const match of text.matchAll(/\s+|\S+/g)) {
    const value = match[0];
    if (value.trim() === "") tokens.push({ kind: "gap", text: value });
    else {
      tokens.push({ kind: "word", index: wordIndex, text: value });
      wordIndex += 1;
    }
  }
  return tokens;
}

function wordIndexFromTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest("[data-word-index]");
  if (!(node instanceof HTMLElement)) return null;
  const raw = node.dataset.wordIndex;
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function nativeLine(
  sentence: ReaderSentence,
  nativeLanguage: NativeLanguage,
  locale: Locale,
): string {
  const text = sentence[nativeLanguage];
  if (text === "") return message(locale, "noTranslation");
  return text;
}

// createElement keeps each sentence string exact. JSX line breaks would insert text nodes.
function sentenceControl(
  sentence: ReaderSentence,
  indexInChapter: number,
  locale: Locale,
  selection: SelectionState,
  onSentence: (id: string) => void,
  onWord: (sentenceId: string, wordIndex: number) => void,
): ReactNode {
  const label = sentenceLabel(locale, indexInChapter + 1);
  const tokens = sentenceTokens(sentence.en);
  const selected = selection.selectedId === sentence.id;
  const selectedWord =
    selected && typeof selection.wordIndex === "number" ? selection.wordIndex : null;
  const content = tokens.map((token, tokenIndex) => {
    if (token.kind === "gap") return createElement(Fragment, { key: `g${tokenIndex}` }, token.text);
    if (!selected) {
      return createElement(
        "span",
        { key: `w${token.index}`, "data-word-index": String(token.index) },
        token.text,
      );
    }
    const wordSelected = selectedWord === token.index;
    return createElement(
      "button",
      {
        key: `w${token.index}`,
        type: "button",
        className: wordSelected ? selectedWordClass : wordButtonClass,
        "aria-pressed": wordSelected,
        onClick: (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          onWord(sentence.id, token.index);
        },
      },
      token.text,
    );
  });

  if (!selected) {
    return createElement(
      "button",
      {
        type: "button",
        className: sentenceButtonClass,
        "aria-label": label,
        "aria-pressed": false,
        onClick: (event: { target: EventTarget | null }) => {
          const wordIndex = wordIndexFromTarget(event.target);
          if (wordIndex === null) onSentence(sentence.id);
          else onWord(sentence.id, wordIndex);
        },
      },
      content,
    );
  }

  return createElement(
    "span",
    {
      className: selectedSentenceClass,
      role: "group",
      "aria-label": label,
      onClick: (event: { target: EventTarget | null }) => {
        if (event.target instanceof Element && event.target.closest("button")) return;
        onSentence(sentence.id);
      },
    },
    content,
  );
}

export function ReaderScreen({
  bookId,
  book,
  chapterId,
  progress,
  nativeLanguage,
  signedIn,
}: {
  bookId: string;
  book: ReaderBook;
  chapterId: string;
  progress: ReaderProgress | null;
  nativeLanguage: NativeLanguage;
  signedIn: boolean;
}) {
  return (
    <ChapterReading
      key={`${bookId}:${chapterId}`}
      bookId={bookId}
      book={book}
      chapterId={chapterId}
      progress={progress}
      nativeLanguage={nativeLanguage}
      signedIn={signedIn}
    />
  );
}

function ChapterReading({
  bookId,
  book,
  chapterId,
  progress,
  nativeLanguage,
  signedIn,
}: {
  bookId: string;
  book: ReaderBook;
  chapterId: string;
  progress: ReaderProgress | null;
  nativeLanguage: NativeLanguage;
  signedIn: boolean;
}) {
  const navigate = useNavigate();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const chapterIndex = book.chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = chapterIndex >= 0 ? book.chapters[chapterIndex] : undefined;
  const [selection, setSelection] = useState<SelectionState>({ selectedId: null });
  const restored = useRef(false);
  const sentences = chapter?.sentences ?? [];
  const selectedIndex = sentences.findIndex((sentence) => sentence.id === selection.selectedId);
  const selected = selectedIndex >= 0 ? sentences[selectedIndex] : undefined;
  const selectedWord =
    selected && typeof selection.wordIndex === "number"
      ? sentenceTokens(selected.en).find(
          (token) => token.kind === "word" && token.index === selection.wordIndex,
        )
      : undefined;
  const gloss =
    selectedWord?.kind === "word" ? lookupWord(selectedWord.text, nativeLanguage) : null;

  useEffect(() => {
    // Restore after mount so the server HTML has no open panel and hydration matches.
    if (restored.current) return;
    restored.current = true;
    if (progress === null) return;
    if (progress.bookId !== bookId || progress.chapterId !== chapterId) return;
    const sentenceId = progress.sentenceId;
    if (sentenceId === null || sentenceId === "") return;
    if (!sentences.some((sentence) => sentence.id === sentenceId)) return;
    setSelection((current) => (current.selectedId === null ? { selectedId: sentenceId } : current));
  }, [bookId, chapterId, progress, sentences]);

  const saveSentence = (sentenceId: string | null) => {
    if (!signedIn) return;
    try {
      // Progress is best-effort and must not block the click.
      const pending = saveProgress({ data: { bookId, chapterId, sentenceId } });
      void Promise.resolve(pending).catch(() => {});
    } catch {
      // Ignore a failed progress write.
    }
  };

  const chooseSentence = (id: string) => {
    const next = selectSentence(selection, id);
    setSelection(next);
    if (next.selectedId !== selection.selectedId) saveSentence(next.selectedId);
  };

  const chooseWord = (sentenceId: string, wordIndex: number) => {
    const next = selectWord(selection, sentenceId, wordIndex);
    setSelection(next);
    if (next.selectedId !== selection.selectedId) saveSentence(next.selectedId);
  };

  const dismiss = () => {
    if (selection.selectedId === null) return;
    setSelection(clearSelection());
    saveSentence(null);
  };

  useEffect(() => {
    if (selection.selectedId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelection(clearSelection());
      saveSentence(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selection.selectedId, bookId, chapterId, signedIn]);

  if (!chapter) return null;

  const previous = chapterIndex > 0 ? book.chapters[chapterIndex - 1] : undefined;
  const next =
    chapterIndex >= 0 && chapterIndex < book.chapters.length - 1
      ? book.chapters[chapterIndex + 1]
      : undefined;
  const translation = selected ? nativeLine(selected, nativeLanguage, locale) : "";

  const openChapter = (nextChapterId: string) => {
    if (nextChapterId === chapterId) return;
    void navigate({
      to: "/books/$bookId/$chapterId",
      params: { bookId, chapterId: nextChapterId },
    });
  };

  return (
    <main lang={locale} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="display-title text-4xl font-medium leading-tight text-foreground">
          {localized(book.title, locale)}
        </h1>
        {book.author ? <p className="text-base text-muted-foreground">{book.author}</p> : null}
        <p className="text-lg text-foreground">{localized(chapter.title, locale)}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor="chapter" className="text-sm font-medium text-foreground">
          {message(locale, "chapterHeading")}
        </label>
        <select
          id="chapter"
          value={chapter.id}
          onChange={(event) => {
            openChapter(event.target.value);
          }}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {book.chapters.map((item) => (
            <option key={item.id} value={item.id}>
              {localized(item.title, locale)}
            </option>
          ))}
        </select>
      </div>

      {previous || next ? (
        <nav className="flex flex-wrap gap-4 text-sm font-medium">
          {previous ? (
            <Link
              to="/books/$bookId/$chapterId"
              params={{ bookId, chapterId: previous.id }}
              className="text-foreground"
            >
              {message(locale, "previousChapter")}
            </Link>
          ) : null}
          {next ? (
            <Link
              to="/books/$bookId/$chapterId"
              params={{ bookId, chapterId: next.id }}
              className="text-foreground"
            >
              {message(locale, "nextChapter")}
            </Link>
          ) : null}
        </nav>
      ) : null}

      <article className="flex flex-col gap-6">
        <p className="text-lg leading-relaxed text-foreground">
          {sentences.map((sentence, index) =>
            createElement(
              Fragment,
              { key: sentence.id },
              index > 0 ? " " : null,
              sentenceControl(sentence, index, locale, selection, chooseSentence, chooseWord),
            ),
          )}
        </p>

        {selected ? (
          <section
            role="region"
            aria-live="polite"
            aria-atomic="true"
            aria-label={translation}
            className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted p-4"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {message(locale, "translation")}
            </p>
            <p className="text-lg leading-relaxed text-foreground">{translation}</p>
            {selectedWord?.kind === "word" ? (
              <p className="text-base leading-relaxed text-foreground">
                <span className="font-medium text-muted-foreground">
                  {message(locale, "dictionary")}
                </span>{" "}
                <span className="font-medium">{selectedWord.text}</span>{" "}
                <span>{gloss === null ? message(locale, "noDictionaryEntry") : gloss}</span>
              </p>
            ) : null}
            <button type="button" onClick={dismiss} className={dismissClass}>
              {message(locale, "dismiss")}
            </button>
          </section>
        ) : (
          <p className="text-base text-muted-foreground">{message(locale, "hint")}</p>
        )}
      </article>
    </main>
  );
}
