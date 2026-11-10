import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { BookBackButton, Reader } from "@/components/reader";
import { ScreenState } from "@/components/screen-state";
import { Screen } from "@/components/ui";
import { fetchBook } from "@/lib/api";
import { chapterView } from "@/lib/chapter-view";
import { bookIdAliases } from "@/lib/library-merge";
import { rememberReading, loadBookMark, readingRatio, type ReadingMark } from "@/lib/reading-progress";
import { routeResume } from "@/lib/reading-resume";
import { useSettings } from "@/lib/settings";
import { space } from "@/lib/theme";
import { displayTitle } from "@/lib/titles";
import type { BookDetail } from "@/lib/types";

function isAbort(reason: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return reason instanceof Error && reason.name === "AbortError";
}

function bookIdFromParams(value: string | string[] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

export default function BookScreen() {
  const params = useLocalSearchParams<{
    bookId?: string | string[];
    chapterId?: string | string[];
    sentenceId?: string | string[];
  }>();
  const bookId = bookIdFromParams(params.bookId);
  const route = routeResume(params.chapterId, params.sentenceId);
  const routeChapter = route?.chapterId ?? "";
  const routeSentence = route?.sentenceId ?? "";
  const { settings } = useSettings();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openIndex, setOpenIndex] = useState(0);
  const [initialSentenceId, setInitialSentenceId] = useState<string | null>(null);

  const retry = useCallback(() => {
    setBook(null);
    setError(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    setOpenIndex(0);
    setInitialSentenceId(null);
    if (bookId === null) {
      setBook(null);
      setError(true);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setBook(null);
    setError(false);
    const routed =
      routeChapter.length > 0
        ? { chapterId: routeChapter, sentenceId: routeSentence.length > 0 ? routeSentence : null }
        : null;
    fetchBook(bookId, controller.signal)
      .then(async (next) => {
        if (!active) return;
        const routeHit = routed !== null ? next.chapters.findIndex((chapter) => chapter.id === routed.chapterId) : -1;
        if (routed && routeHit >= 0) {
          const sentences = next.chapters[routeHit]?.sentences ?? [];
          setOpenIndex(routeHit);
          setInitialSentenceId(
            routed.sentenceId !== null && sentences.some((sentence) => sentence.id === routed.sentenceId)
              ? routed.sentenceId
              : null,
          );
        } else {
          const loadedMarks = await Promise.all(bookIdAliases(bookId).map((id) => loadBookMark(id)));
          if (!active) return;
          let mark: ReadingMark | null = null;
          for (const candidate of loadedMarks) {
            if (!candidate) continue;
            if (!mark || candidate.updatedAt > mark.updatedAt) mark = candidate;
          }
          if (mark) {
            const chosen = mark;
            const found = next.chapters.findIndex((chapter) => chapter.id === chosen.chapterId);
            const sentences = found >= 0 ? (next.chapters[found]?.sentences ?? []) : [];
            if (found >= 0) {
              setOpenIndex(found);
              setInitialSentenceId(
                chosen.sentenceId !== null && sentences.some((sentence) => sentence.id === chosen.sentenceId)
                  ? chosen.sentenceId
                  : null,
              );
            }
          }
        }
        setBook(next);
        setError(false);
      })
      .catch((reason: unknown) => {
        if (!active || isAbort(reason, controller.signal)) return;
        console.error(reason);
        setBook(null);
        setError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, bookId, routeChapter, routeSentence]);

  const view = book === null ? null : chapterView(book, openIndex);
  const chapterId = view?.chapters[openIndex]?.id ?? "book";

  const remember = (index: number, sentenceId: string | null, sentenceIndex: number) => {
    if (book === null || bookId === null) return;
    const chapter = book.chapters[index];
    if (!chapter) return;
    const counts = book.chapters.map((item) => item.sentences.length);
    void rememberReading({
      bookId,
      source: "catalog",
      chapterId: chapter.id,
      chapterIndex: index,
      chapterCount: book.chapters.length,
      sentenceId,
      sentenceIndex,
      ratio: readingRatio(counts, index, sentenceIndex),
      title: displayTitle(book.title, settings.interfaceLocale),
      author: book.author,
      updatedAt: Date.now(),
    });
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      {view === null || book === null ? (
        <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.lg }}>
          <BookBackButton />
          <ScreenState
            locale={settings.interfaceLocale}
            error={error || bookId === null}
            onRetry={retry}
          />
        </View>
      ) : (
        <Reader
          key={`${bookId ?? "book"}:${chapterId}`}
          book={view}
          openIndex={openIndex}
          initialSentenceId={initialSentenceId}
          onOpenChapter={(index) => {
            setInitialSentenceId(null);
            setOpenIndex(index);
            remember(index, null, 0);
          }}
          onReadingMark={(mark) => {
            remember(openIndex, mark.sentenceId, mark.sentenceIndex);
          }}
        />
      )}
    </Screen>
  );
}
