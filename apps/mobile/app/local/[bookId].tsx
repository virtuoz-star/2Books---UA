import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { BookBackButton, Reader } from "@/components/reader";
import { ScreenState } from "@/components/screen-state";
import { Screen } from "@/components/ui";
import { bookIdAliases } from "@/lib/library-merge";
import {
  loadLocalBook,
  loadLocalChapter,
  readStoredPosition,
  writeLocalPosition,
  type StoredLocalBook,
} from "@/lib/local-library";
import { loadBookMark, rememberReading, readingRatio, type ReadingMark } from "@/lib/reading-progress";
import { resumeLocalReading, routeResume } from "@/lib/reading-resume";
import { useSettings } from "@/lib/settings";
import { space } from "@/lib/theme";
import { displayTitle } from "@/lib/titles";
import type { BookDetail, Chapter } from "@/lib/types";

function bookIdFromParams(value: string | string[] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

function localView(book: StoredLocalBook, openIndex: number, chapter: Chapter): BookDetail {
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    chapters: book.chapters.map((item, index) =>
      index === openIndex
        ? { id: item.id, title: item.title, sentences: chapter.sentences }
        : { id: item.id, title: item.title, sentences: [] },
    ),
  };
}

export default function LocalBookScreen() {
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
  const [stored, setStored] = useState<StoredLocalBook | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [openIndex, setOpenIndex] = useState(0);
  const [initialSentenceId, setInitialSentenceId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [partError, setPartError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  const failedIndex = useRef<number | null>(null);

  const retry = useCallback(() => {
    setStored(null);
    setChapter(null);
    setError(false);
    setPartError(false);
    setAttempt((value) => value + 1);
  }, []);

  const remember = useCallback(
    (book: StoredLocalBook, index: number, sentenceId: string | null, sentenceIndex: number) => {
      const meta = book.chapters[index];
      if (!meta || bookId === null) return;
      const counts = book.chapters.map((item) => item.sentenceCount);
      void rememberReading({
        bookId,
        source: "local",
        chapterId: meta.id,
        chapterIndex: index,
        chapterCount: book.chapters.length,
        sentenceId,
        sentenceIndex,
        ratio: readingRatio(counts, index, sentenceIndex),
        title: displayTitle(book.title, settings.interfaceLocale),
        author: book.author,
        updatedAt: Date.now(),
      });
    },
    [bookId, settings.interfaceLocale],
  );

  useEffect(() => {
    if (bookId === null) {
      setStored(null);
      setChapter(null);
      setError(true);
      return;
    }
    let active = true;
    setStored(null);
    setChapter(null);
    setError(false);
    setPartError(false);
    const routed =
      routeChapter.length > 0
        ? { chapterId: routeChapter, sentenceId: routeSentence.length > 0 ? routeSentence : null }
        : null;
    void (async () => {
      try {
        const loaded = await loadLocalBook(bookId);
        if (!active) return;
        if (loaded.status !== "ready") {
          setError(true);
          return;
        }
        const position = await readStoredPosition(bookId);
        if (!active) return;
        const routeOk =
          routed !== null && loaded.book.chapters.some((chapter) => chapter.id === routed.chapterId);
        const positionOk =
          position !== null && loaded.book.chapters.some((chapter) => chapter.id === position.chapterId);
        let marks: ReadingMark[] = [];
        if (!routeOk && !positionOk) {
          const loadedMarks = await Promise.all(bookIdAliases(bookId).map((id) => loadBookMark(id)));
          if (!active) return;
          marks = loadedMarks.filter((mark): mark is ReadingMark => mark !== null);
        }
        const resume = resumeLocalReading({
          chapters: loaded.book.chapters,
          route: routeOk ? routed : null,
          position: positionOk ? position : null,
          readingMarks: marks,
        });
        let openIndex = loaded.openIndex;
        let chapter = loaded.chapter;
        let sentenceId = loaded.sentenceId;
        if (resume) {
          const index = loaded.book.chapters.findIndex((item) => item.id === resume.chapterId);
          if (index >= 0 && loaded.book.chapters[index]?.id !== loaded.chapter.id) {
            const next = await loadLocalChapter(bookId, resume.chapterId);
            if (!active) return;
            if (next === null) {
              setError(true);
              return;
            }
            chapter = next;
            openIndex = index;
          } else if (index >= 0) {
            openIndex = index;
          }
          sentenceId =
            resume.sentenceId !== null && chapter.sentences.some((item) => item.id === resume.sentenceId)
              ? resume.sentenceId
              : null;
          if (resume.source !== "position") {
            const chapterId = loaded.book.chapters[openIndex]?.id;
            if (chapterId) {
              void writeLocalPosition(bookId, { chapterId, sentenceId }).catch(() => {
                // Reading position is local and best-effort.
              });
            }
          }
        }
        setStored(loaded.book);
        setChapter(chapter);
        setOpenIndex(openIndex);
        setInitialSentenceId(sentenceId);
        setError(false);
        if (sentenceId) {
          const index = chapter.sentences.findIndex((sentence) => sentence.id === sentenceId);
          remember(loaded.book, openIndex, sentenceId, index < 0 ? 0 : index);
        }
      } catch {
        if (!active) return;
        console.error("local-import", "io");
        setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt, bookId, remember, routeChapter, routeSentence]);

  const changeChapter = (index: number) => {
    if (stored === null || bookId === null || index === openIndex) return;
    const meta = stored.chapters[index];
    if (!meta) return;
    const ticket = request.current + 1;
    request.current = ticket;
    failedIndex.current = index;
    void loadLocalChapter(bookId, meta.id)
      .then(async (next) => {
        if (request.current !== ticket) return;
        if (next === null) {
          setPartError(true);
          return;
        }
        setPartError(false);
        setInitialSentenceId(null);
        setChapter(next);
        setOpenIndex(index);
        remember(stored, index, null, 0);
        try {
          await writeLocalPosition(bookId, { chapterId: meta.id, sentenceId: null });
        } catch {
          // Reading position is local and best-effort.
        }
      })
      .catch(() => {
        if (request.current !== ticket) return;
        setPartError(true);
      });
  };

  const view = stored !== null && chapter !== null ? localView(stored, openIndex, chapter) : null;
  const chapterId = stored?.chapters[openIndex]?.id ?? "local";

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      {view === null || bookId === null || stored === null ? (
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
          key={`${bookId}:${chapterId}`}
          book={view}
          openIndex={openIndex}
          initialSentenceId={initialSentenceId}
          partError={partError}
          onRetryPart={() => {
            const index = failedIndex.current;
            if (index === null) return;
            setPartError(false);
            changeChapter(index);
          }}
          onOpenChapter={changeChapter}
          wordSource="local"
          onReadingMark={(mark) => {
            const meta = stored.chapters[openIndex];
            if (!meta) return;
            remember(stored, openIndex, mark.sentenceId, mark.sentenceIndex);
            void writeLocalPosition(bookId, {
              chapterId: meta.id,
              sentenceId: mark.sentenceId,
            }).catch(() => {
              // A failed position write leaves the previous file in place.
            });
          }}
        />
      )}
    </Screen>
  );
}
