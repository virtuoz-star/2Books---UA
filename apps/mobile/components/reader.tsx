import { useNavigation, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { PracticeSession } from "@/components/practice";
import { ReadingPreferences } from "@/components/reading-preferences";
import { Button, IconButton, Notice, ProgressBar, Sheet, TopBar, useSnackbar } from "@/components/ui";
import {
  openPublicTranslate,
  postPhoneGoogleTranslate,
  readPhoneGoogleKey,
} from "@/lib/google-translate";
import { message, nextPartTitle, partProgress, partStudyLine, sentenceLabel } from "@/lib/messages";
import { nativeLine, storedSentenceNative } from "@/lib/native-line";
import { emptyPartStudy, noteSavedWord, noteTranslation, type PartStudy } from "@/lib/part-study";
import { type PracticeCard } from "@/lib/practice";
import {
  scrollOffsetForSentence,
  sentenceRows,
  visibleSentence,
  type SentenceRowModel,
} from "@/lib/sentence-place";
import { forgetWord, loadSavedWords, rememberWord, subscribeSavedWords } from "@/lib/saved-words-store";
import { useSettings } from "@/lib/settings";
import { readingFontFamily, readingMetrics, space, uiScaleCap, useTheme } from "@/lib/theme";
import { chapterLabel, displayTitle } from "@/lib/titles";
import type { BookDetail, Locale, Sentence } from "@/lib/types";
import { lookupWord, normalizeWord } from "../../../src/dictionary/lookup";
import { hasSavedWord, savedWordKey, type SavedWord } from "../../../src/dictionary/saved-words";
import {
  clearSelection,
  selectSentence,
  selectWord,
  type SelectionState,
} from "../../../src/reader/selection";
import { sentenceTokens } from "../../../src/reader/tokens";

type WindowNode = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

function measurable(node: unknown): WindowNode | null {
  if (typeof node !== "object" || node === null || !("measureInWindow" in node)) return null;
  if (typeof node.measureInWindow !== "function") return null;
  return node as WindowNode;
}

type ReadingMark = { sentenceId: string; sentenceIndex: number };
type SentenceRow = SentenceRowModel<Sentence>;

function speechChunks(text: string, limit: number): string[] | null {
  if (!Number.isFinite(limit) || limit <= 0) return null;
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    let cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf(" "), window.lastIndexOf(", "));
    if (cut < Math.floor(limit * 0.4)) cut = limit;
    const piece = rest.slice(0, cut).trim();
    if (piece.length === 0) return null;
    chunks.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

function savedUnderline(color: string) {
  return {
    textDecorationLine: "underline" as const,
    textDecorationStyle: "dotted" as const,
    textDecorationColor: color,
  };
}

function saveFailedLine(locale: Locale): string {
  if (locale === "uk") return "Не вдалося зберегти це слово.";
  if (locale === "ru") return "Не удалось сохранить это слово.";
  return "Could not save this word.";
}

export function BookBackButton() {
  const router = useRouter();
  const { settings } = useSettings();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <IconButton icon="chevron-left" label={message(settings.interfaceLocale, "back")} onPress={goBack} />
  );
}

const SentenceRowView = memo(function SentenceRowView({
  row,
  activeSentenceId,
  wordIndex,
  onSentence,
  onWord,
  onLayoutHeight,
  onSentenceNode,
  index,
  savedWords,
}: {
  row: SentenceRow;
  activeSentenceId: string | null;
  wordIndex: number | null;
  onSentence: (id: string) => void;
  onWord: (sentenceId: string, wordIndex: number) => void;
  onLayoutHeight: (index: number, height: number) => void;
  onSentenceNode: (id: string, node: WindowNode | null) => void;
  index: number;
  savedWords: readonly SavedWord[];
}) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const locale = settings.interfaceLocale;
  const metrics = readingMetrics[settings.readingSize];
  const fontFamily = readingFontFamily(settings.readingFont);
  const reading = {
    color: colors.ink,
    fontFamily,
    fontSize: metrics.fontSize,
    lineHeight: metrics.lineHeight,
  };
  const selected = row.sentence.id === activeSentenceId;
  const label = row.sentence.en.trim().length > 0 ? row.sentence.en : sentenceLabel(locale, row.index + 1);
  const native = settings.nativeLanguage;
  const tokens = sentenceTokens(row.sentence.en);
  const savedInSentence = tokens.some(
    (token) => token.kind === "word" && hasSavedWord(savedWords, token.text, native),
  );
  const wordsOpen = selected;
  const split = wordsOpen || savedInSentence;
  return (
    <View
      onLayout={(event) => {
        onLayoutHeight(index, event.nativeEvent.layout.height);
      }}
      style={{ marginBottom: row.paragraphEnd ? 18 : 8 }}
    >
      <Text
        style={
          selected
            ? [
                reading,
                {
                  backgroundColor: colors.tideWash,
                  borderLeftWidth: 3,
                  borderLeftColor: colors.tide,
                },
              ]
            : reading
        }
        maxFontSizeMultiplier={0}
        accessibilityLanguage="en"
        accessibilityRole={wordsOpen ? undefined : "button"}
        accessibilityLabel={wordsOpen ? undefined : label}
        accessibilityHint={wordsOpen ? undefined : message(locale, "sentenceHint")}
        accessibilityState={wordsOpen ? undefined : { selected }}
        accessibilityActions={
          wordsOpen ? undefined : selected ? [{ name: "hide", label: message(locale, "dismiss") }] : undefined
        }
        accessible={wordsOpen ? false : split ? true : undefined}
        ref={(node) => {
          onSentenceNode(row.sentence.id, measurable(node));
        }}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "hide") onSentence(row.sentence.id);
        }}
        onPress={() => {
          onSentence(row.sentence.id);
        }}
        suppressHighlighting
      >
        {split
          ? tokens.map((token) => {
              if (token.kind === "gap") return token.text;
              const normalized = normalizeWord(token.text);
              const saved = normalized !== "" && hasSavedWord(savedWords, token.text, native);
              const marked = wordsOpen && wordIndex === token.index;
              if (normalized === "") return token.text;
              if (!wordsOpen) {
                if (!saved) return token.text;
                return (
                  <Text key={`w${token.index}`} style={savedUnderline(colors.ink)} suppressHighlighting>
                    {token.text}
                  </Text>
                );
              }
              return (
                <Text
                  key={`w${token.index}`}
                  accessibilityRole={Platform.OS === "android" ? "link" : "button"}
                  accessibilityLabel={token.text}
                  accessibilityState={{ selected: marked }}
                  onPress={() => {
                    onWord(row.sentence.id, token.index);
                  }}
                  style={
                    marked
                      ? {
                          backgroundColor: colors.marker,
                          color: colors.markerInk,
                          borderRadius: 4,
                        }
                      : saved
                        ? savedUnderline(colors.ink)
                        : undefined
                  }
                  suppressHighlighting
                >
                  {token.text}
                </Text>
              );
            })
          : row.sentence.en}
      </Text>
    </View>
  );
});

export function Reader({
  book,
  openIndex,
  initialSentenceId = null,
  onOpenChapter,
  onReadingMark,
  partError = false,
  onRetryPart,
  wordSource = "catalog",
}: {
  book: BookDetail;
  openIndex: number;
  initialSentenceId?: string | null;
  onOpenChapter: (index: number) => void;
  onReadingMark?: (mark: ReadingMark) => void;
  partError?: boolean;
  onRetryPart?: () => void;
  wordSource?: "catalog" | "local";
}) {
  const router = useRouter();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const { settings, patchSettings } = useSettings();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const locale = settings.interfaceLocale;
  const native = settings.nativeLanguage;
  const chapterCount = book.chapters.length;
  const safeIndex = chapterCount === 0 ? 0 : Math.min(Math.max(openIndex, 0), chapterCount - 1);
  const chapter = chapterCount > 0 ? book.chapters[safeIndex] : null;
  const sentences = chapter?.sentences ?? [];
  const rows = useMemo(() => sentenceRows(sentences), [sentences]);
  const [selection, setSelection] = useState<SelectionState>({ selectedId: null });
  const [partsOpen, setPartsOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [bar, setBar] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [readingPart, setReadingPart] = useState(false);
  const [speakFailed, setSpeakFailed] = useState(false);
  const [googleLine, setGoogleLine] = useState<{ key: string; text: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateFailed, setTranslateFailed] = useState(false);
  const [explainTranslate, setExplainTranslate] = useState(false);
  const [partStudy, setPartStudy] = useState<PartStudy>(() => emptyPartStudy());
  const [partPractice, setPartPractice] = useState<readonly PracticeCard[] | null>(null);
  const partKey = `${book.id}:${chapter?.id ?? safeIndex}`;
  const [partKeySeen, setPartKeySeen] = useState(partKey);
  if (partKeySeen !== partKey) {
    setPartKeySeen(partKey);
    setPartPractice(null);
    setPartStudy(emptyPartStudy());
    setSelection(clearSelection());
  }
  const partCards = useMemo(() => {
    const wanted = new Set(partStudy.words);
    return savedWords.filter((word) => {
      if (word.nativeLanguage !== native) return false;
      const key = savedWordKey(word.word, word.nativeLanguage);
      return key !== null && wanted.has(key);
    });
  }, [native, partStudy.words, savedWords]);
  const savingWord = useRef(false);
  const speechGeneration = useRef(0);
  const translateAbort = useRef<AbortController | null>(null);
  const translateRequest = useRef(0);
  const listRef = useRef<FlatList<SentenceRow>>(null);
  const sentenceNodes = useRef(new Map<string, WindowNode>());
  const headerHeight = useRef(0);
  const rowHeights = useRef<number[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const rowsKey = rows.map((row) => row.key).join("\0");
  const measuredKey = useRef(rowsKey);
  if (measuredKey.current !== rowsKey) {
    measuredKey.current = rowsKey;
    rowHeights.current = [];
  }
  const scrollOffset = useRef(0);
  const lastMarked = useRef<string | null>(null);
  const lastMarkAt = useRef(0);
  const restored = useRef(initialSentenceId === null);
  const scrollRetries = useRef(0);
  const loadTicket = useRef(0);
  const onReadingMarkRef = useRef(onReadingMark);
  onReadingMarkRef.current = onReadingMark;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const selected = sentences.find((sentence) => sentence.id === selection.selectedId);
  const selectedWord =
    selected && typeof selection.wordIndex === "number"
      ? sentenceTokens(selected.en).find(
          (token) => token.kind === "word" && token.index === selection.wordIndex,
        )
      : undefined;
  const normalized = selectedWord?.kind === "word" ? normalizeWord(selectedWord.text) : "";
  const gloss = normalized === "" || selectedWord?.kind !== "word" ? null : lookupWord(selectedWord.text, native);
  const translateIdentity = `${selection.selectedId ?? ""}:${selection.wordIndex ?? ""}:${native}:${normalized}`;
  const wordSaved =
    selectedWord?.kind === "word" && normalized !== "" && hasSavedWord(savedWords, selectedWord.text, native);

  const publishMark = useCallback((mark: ReadingMark) => {
    if (!restored.current || lastMarked.current === mark.sentenceId) return;
    lastMarked.current = mark.sentenceId;
    onReadingMarkRef.current?.(mark);
  }, []);

  const sentenceAt = useCallback((offset: number): ReadingMark | null => {
    return visibleSentence(
      offset,
      headerHeight.current,
      rowsRef.current.map((row, index) => ({
        id: row.sentence.id,
        index: row.index,
        height: rowHeights.current[index] ?? 0,
      })),
    );
  }, []);

  const reloadWords = useCallback(() => {
    const ticket = ++loadTicket.current;
    void loadSavedWords()
      .then((words) => {
        if (loadTicket.current !== ticket) return;
        setSavedWords(words);
        setLoadFailed(false);
      })
      .catch((reason: unknown) => {
        console.error(reason);
        if (loadTicket.current !== ticket) return;
        setLoadFailed(true);
      });
  }, []);

  useEffect(() => {
    reloadWords();
    const unsubscribe = subscribeSavedWords(reloadWords);
    return () => {
      loadTicket.current += 1;
      unsubscribe();
    };
  }, [reloadWords]);

  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader);
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    setSpeakFailed(false);
    return () => {
      speechGeneration.current += 1;
      setSpeaking(false);
      void Speech.stop().catch(() => {
        console.error("speech");
      });
    };
  }, [selection.selectedId, safeIndex]);

  useEffect(() => {
    translateRequest.current += 1;
    translateAbort.current?.abort();
    translateAbort.current = null;
    setGoogleLine(null);
    setTranslating(false);
    setTranslateFailed(false);
    setExplainTranslate(false);
    return () => {
      translateRequest.current += 1;
      translateAbort.current?.abort();
    };
  }, [translateIdentity]);

  useEffect(() => {
    if (selection.selectedId === null || selected === undefined) return;
    const line = nativeLine(selected, native, locale);
    AccessibilityInfo.announceForAccessibility(`${message(locale, "translation")}: ${line}`);
  }, [locale, native, selected, selection.selectedId]);

  const dismissSelection = useCallback(() => {
    if (selectionRef.current.wordIndex != null && !settingsRef.current.wordHintSeen) {
      patchSettings({ wordHintSeen: true });
    }
    setSelection(clearSelection());
  }, [patchSettings]);

  const navigation = useNavigation();
  const practiceOpen = partPractice !== null && partPractice.length > 0;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !practiceOpen });
    return () => {
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation, practiceOpen]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (partPractice !== null) {
        setPartPractice(null);
        return true;
      }
      if (partsOpen) {
        setPartsOpen(false);
        return true;
      }
      if (readingOpen) {
        setReadingOpen(false);
        return true;
      }
      if (selectionRef.current.selectedId !== null) {
        dismissSelection();
        return true;
      }
      return false;
    });
    return () => {
      subscription.remove();
    };
  }, [dismissSelection, partPractice, partsOpen, readingOpen]);

  useEffect(() => {
    if (initialSentenceId === null) {
      restored.current = true;
      return;
    }
    let frames = 0;
    let frame = 0;
    let reveal: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      frames += 1;
      const index = rowsRef.current.findIndex((row) => row.sentence.id === initialSentenceId);
      if (index < 0) {
        restored.current = true;
        return;
      }
      const headerKnown = headerHeight.current > 0 || frames > 8;
      const measured = headerKnown
        ? scrollOffsetForSentence(headerHeight.current, rowHeights.current, index)
        : null;
      if (measured === null && frames < 24) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (measured === null) {
        scrollRetries.current = 0;
        listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
      } else {
        listRef.current?.scrollToOffset({ offset: measured, animated: false });
      }
      reveal = setTimeout(() => {
        restored.current = true;
      }, 250);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      if (reveal !== null) clearTimeout(reveal);
    };
  }, [initialSentenceId, rows]);

  useEffect(() => {
    if (selection.selectedId === null || sheetHeight <= 0) return;
    const node = sentenceNodes.current.get(selection.selectedId);
    if (!node) return;
    const timer = setTimeout(() => {
      node.measureInWindow((_x, y, _width, measured) => {
        const limit = windowHeight - sheetHeight - 12;
        if (y + measured > limit) {
          listRef.current?.scrollToOffset({
            offset: scrollOffset.current + (y + measured - limit),
            animated: true,
          });
        }
      });
    }, 60);
    return () => {
      clearTimeout(timer);
    };
  }, [selection.selectedId, sheetHeight, windowHeight]);

  const chooseSentence = useCallback(
    (id: string) => {
      const next = selectSentence(selectionRef.current, id);
      setSelection(next);
      if (next.selectedId === null) return;
      const opened = next.selectedId;
      const sentence = sentences.find((item) => item.id === opened);
      if (sentence && (sentence.uk.trim() !== "" || sentence.ru.trim() !== "")) {
        setPartStudy((current) => noteTranslation(current, opened));
      }
      if (!settingsRef.current.hintSeen) patchSettings({ hintSeen: true });
      const index = sentences.findIndex((sentence) => sentence.id === next.selectedId);
      if (index >= 0) publishMark({ sentenceId: id, sentenceIndex: index });
    },
    [patchSettings, publishMark, sentences],
  );

  const chooseWord = useCallback((sentenceId: string, wordIndex: number) => {
    const sentence = sentences.find((item) => item.id === sentenceId);
    const token = sentence
      ? sentenceTokens(sentence.en).find((item) => item.kind === "word" && item.index === wordIndex)
      : undefined;
    if (!token || token.kind !== "word" || normalizeWord(token.text) === "") return;
    const next = selectWord(selectionRef.current, sentenceId, wordIndex);
    setSelection(next);
  }, [sentences]);

  const onLayoutHeight = useCallback((index: number, height: number) => {
    rowHeights.current[index] = height;
  }, []);

  const onSentenceNode = useCallback((id: string, node: WindowNode | null) => {
    if (node) sentenceNodes.current.set(id, node);
    else sentenceNodes.current.delete(id);
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffset.current = offset;
      const viewHeight = event.nativeEvent.layoutMeasurement.height;
      const contentHeight = event.nativeEvent.contentSize.height;
      const span = contentHeight - viewHeight;
      setBar(span <= 1 ? (contentHeight > 0 ? 1 : 0) : Math.min(1, Math.max(0, offset / span)));
      const mark = sentenceAt(offset);
      if (mark && Date.now() - lastMarkAt.current > 400) {
        lastMarkAt.current = Date.now();
        publishMark(mark);
      }
    },
    [publishMark, sentenceAt],
  );

  const translateSurface = (surface: string, sentenceId: string, wordIndex: number) => {
    const normalizedWord = normalizeWord(surface);
    if (normalizedWord === "" || translating) return;
    const controller = new AbortController();
    translateAbort.current?.abort();
    translateAbort.current = controller;
    const id = ++translateRequest.current;
    const wordKey = `${sentenceId}:${wordIndex}:${native}:${normalizedWord}`;
    setTranslating(true);
    setTranslateFailed(false);
    setExplainTranslate(false);
    void (async () => {
      const key = await readPhoneGoogleKey();
      if (id !== translateRequest.current) return;
      if (key.length === 0) {
        setTranslating(false);
        setExplainTranslate(true);
        return;
      }
      const result = await postPhoneGoogleTranslate({
        key,
        q: [normalizedWord],
        target: native,
        signal: controller.signal,
        timeoutMs: 15_000,
      });
      if (id !== translateRequest.current) return;
      setTranslating(false);
      if (!result.ok) {
        if (result.status !== "aborted") setTranslateFailed(true);
        return;
      }
      const text = result.rows[0]?.text ?? null;
      if (text === null || text === "") {
        setTranslateFailed(true);
        return;
      }
      setGoogleLine({ key: wordKey, text });
      AccessibilityInfo.announceForAccessibility(`${message(locale, "translation")}: ${text}`);
    })();
  };

  const saveSurface = (surface: string, sentence: Sentence) => {
    if (savingWord.current) return;
    const showing =
      googleLine !== null && googleLine.key === translateIdentity && googleLine.text !== "";
    savingWord.current = true;
    void (async () => {
      try {
        setSavedWords(
          await rememberWord({
            word: surface,
            gloss: showing ? googleLine.text : (lookupWord(surface, native) ?? ""),
            nativeLanguage: native,
            sentence: { en: sentence.en, native: storedSentenceNative(sentence, native) },
            place:
              chapter === null
                ? undefined
                : {
                    bookId: book.id,
                    chapterId: chapter.id,
                    sentenceId: sentence.id,
                    bookSource: wordSource,
                  },
          }),
        );
        const key = savedWordKey(surface, native);
        if (key !== null) setPartStudy((current) => noteSavedWord(current, key));
        setSaveFailed(false);
        snackbar.show(message(locale, "savedWord"));
      } catch (reason: unknown) {
        console.error(reason);
        setSaveFailed(true);
      } finally {
        savingWord.current = false;
      }
    })();
  };

  const forgetSurface = (surface: string) => {
    if (savingWord.current) return;
    savingWord.current = true;
    void (async () => {
      try {
        setSavedWords(await forgetWord(surface, native));
        setSaveFailed(false);
        snackbar.show(message(locale, "wordRemoved"));
      } catch (reason: unknown) {
        console.error(reason);
        setSaveFailed(true);
      } finally {
        savingWord.current = false;
      }
    })();
  };

  const speakQueue = (chunks: string[], id: number, index: number) => {
    const chunk = chunks[index];
    if (!chunk || id !== speechGeneration.current) {
      if (id === speechGeneration.current) setSpeaking(false);
      return;
    }
    try {
      Speech.speak(chunk, {
        language: Platform.OS === "android" ? "en" : "en-US",
        rate: 0.75,
        pitch: 1,
        onDone: () => {
          speakQueue(chunks, id, index + 1);
        },
        onStopped: () => {
          if (id === speechGeneration.current) setSpeaking(false);
        },
        onError: () => {
          if (id !== speechGeneration.current) return;
          console.error("speech");
          setSpeaking(false);
          setSpeakFailed(true);
        },
      });
    } catch {
      if (id !== speechGeneration.current) return;
      console.error("speech");
      setSpeaking(false);
      setSpeakFailed(true);
    }
  };

  const stopSpeech = () => {
    speechGeneration.current += 1;
    setSpeaking(false);
    setReadingPart(false);
    void Speech.stop().catch(() => {
      console.error("speech");
      setSpeakFailed(true);
    });
  };

  const speakSentence = () => {
    if (selected === undefined || selected.en.trim() === "") return;
    if (speaking) {
      stopSpeech();
      return;
    }
    const chunks = speechChunks(selected.en, Speech.maxSpeechInputLength);
    if (chunks === null) {
      setSpeakFailed(true);
      setSpeaking(false);
      return;
    }
    const id = ++speechGeneration.current;
    setSpeakFailed(false);
    setSpeaking(true);
    void (async () => {
      try {
        await Speech.stop();
      } catch {
        if (id !== speechGeneration.current) return;
        console.error("speech");
        setSpeaking(false);
        setSpeakFailed(true);
        return;
      }
      if (id !== speechGeneration.current) return;
      speakQueue(chunks, id, 0);
    })();
  };

  const title = displayTitle(book.title, locale);
  const bannerLine = selected === undefined ? "" : nativeLine(selected, native, locale);
  const phoneWord = selected !== undefined && selectedWord?.kind === "word" && normalized !== "" ? selectedWord : null;
  const speakWord = () => {
    if (phoneWord === null || phoneWord.kind !== "word") return;
    const text = phoneWord.text.trim();
    if (text === "") return;
    if (speaking) {
      stopSpeech();
      return;
    }
    const id = ++speechGeneration.current;
    setSpeakFailed(false);
    setSpeaking(true);
    void (async () => {
      try {
        await Speech.stop();
      } catch {
        if (id !== speechGeneration.current) return;
        setSpeaking(false);
        setSpeakFailed(true);
        return;
      }
      if (id !== speechGeneration.current) return;
      Speech.speak(text, {
        language: Platform.OS === "android" ? "en" : "en-US",
        rate: 0.75,
        onDone: () => {
          if (id === speechGeneration.current) setSpeaking(false);
        },
        onStopped: () => {
          if (id === speechGeneration.current) setSpeaking(false);
        },
        onError: () => {
          if (id !== speechGeneration.current) return;
          setSpeaking(false);
          setSpeakFailed(true);
        },
      });
    })();
  };
  const readPart = () => {
    if (readingPart || speaking) {
      stopSpeech();
      return;
    }
    const found = sentences.findIndex((sentence) => sentence.id === selection.selectedId);
    const start = found < 0 ? 0 : found;
    const id = ++speechGeneration.current;
    setReadingPart(true);
    setSpeaking(true);
    setSpeakFailed(false);
    const step = (index: number) => {
      if (id !== speechGeneration.current) return;
      const sentence = sentences[index];
      if (!sentence) {
        setReadingPart(false);
        setSpeaking(false);
        return;
      }
      const text = sentence.en.trim();
      if (text === "") {
        step(index + 1);
        return;
      }
      setSelection(selectSentence({ selectedId: null }, sentence.id));
      const rowIndex = rows.findIndex((row) => row.sentence.id === sentence.id);
      if (rowIndex >= 0) listRef.current?.scrollToIndex({ index: rowIndex, viewPosition: 0.25 });
      Speech.speak(text, {
        language: Platform.OS === "android" ? "en" : "en-US",
        rate: 0.75,
        onDone: () => {
          step(index + 1);
        },
        onStopped: () => {
          if (id !== speechGeneration.current) return;
          setSpeaking(false);
          setReadingPart(false);
        },
        onError: () => {
          if (id !== speechGeneration.current) return;
          setSpeaking(false);
          setReadingPart(false);
          setSpeakFailed(true);
        },
      });
    };
    void Speech.stop()
      .catch(() => {})
      .finally(() => {
        if (id === speechGeneration.current) step(start);
      });
  };
  const machineLine =
    googleLine !== null && googleLine.key === translateIdentity && googleLine.text !== ""
      ? googleLine.text
      : "";
  const stackNav = fontScale > 1.3;
  const nextChapter = book.chapters[safeIndex + 1];
  const sheetLimit = Math.max(
    120,
    Math.min(windowHeight * 0.7 - 96, windowHeight * 0.5 * Math.max(fontScale, 1)),
  );

  const header = (
    <View
      onLayout={(event) => {
        headerHeight.current = event.nativeEvent.layout.height;
      }}
      style={{ gap: space.md, paddingTop: space.sm }}
    >
      {partError ? (
        <Notice
          text={message(locale, "loadError")}
          actionLabel={message(locale, "retry")}
          onAction={onRetryPart}
        />
      ) : null}
      {chapter === null ? (
        <Text style={{ color: colors.quiet, fontSize: 16 }}>{message(locale, "emptyBook")}</Text>
      ) : (
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={uiScaleCap}
          style={{
            color: colors.ink,
            fontFamily: "Literata",
            fontSize: 22,
            lineHeight: 28,
          }}
        >
          {chapterLabel(chapter.title, safeIndex, locale)}
        </Text>
      )}
      {settings.hintSeen || chapter === null ? null : (
        <View style={{ gap: space.sm }}>
          <Text style={{ color: colors.quiet, fontSize: 15, lineHeight: 21 }}>{message(locale, "hint")}</Text>
          <Button
            variant="quiet"
            label={message(locale, "close")}
            onPress={() => {
              patchSettings({ hintSeen: true });
            }}
          />
        </View>
      )}
    </View>
  );

  const footer =
    chapter === null ? null : (
      <View style={{ gap: space.md, paddingTop: space.lg }}>
        <Text style={{ color: colors.quiet, fontSize: 16, lineHeight: 22 }}>
          {partStudyLine(locale, partStudy.translations.length, partStudy.words.length)}
        </Text>
        {sentences.length > 0 ? (
          <Button
            variant="secondary"
            label={message(locale, readingPart ? "stopSpeech" : "readPart")}
            onPress={readPart}
          />
        ) : null}
        {partCards.length > 0 ? (
          <Button
            variant="secondary"
            label={message(locale, "practice")}
            onPress={() => {
              stopSpeech();
              setPartPractice(partCards);
            }}
          />
        ) : null}
        <View style={{ gap: space.sm, flexDirection: stackNav ? "column" : "row" }}>
          {safeIndex >= chapterCount - 1 || !nextChapter ? (
            <Text style={{ color: colors.quiet, fontSize: 16, flex: 1 }}>{message(locale, "finishedBook")}</Text>
          ) : (
            <Button
              label={nextPartTitle(locale, chapterLabel(nextChapter.title, safeIndex + 1, locale))}
              onPress={() => {
                onOpenChapter(safeIndex + 1);
              }}
              style={{ flex: stackNav ? undefined : 1 }}
            />
          )}
          {safeIndex > 0 ? (
            <Button
              variant="quiet"
              label={message(locale, "previousPart")}
              onPress={() => {
                onOpenChapter(safeIndex - 1);
              }}
              style={{ flex: stackNav ? undefined : 1 }}
            />
          ) : null}
        </View>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.blotter }}>
      <TopBar
        title={title}
        subtitle={chapterCount > 0 ? partProgress(locale, safeIndex + 1, chapterCount) : undefined}
        onSubtitlePress={chapterCount > 0 ? () => setPartsOpen(true) : undefined}
        leading={<BookBackButton />}
        trailing={
          <IconButton
            icon="type"
            label={message(locale, "readingSettings")}
            onPress={() => {
              setReadingOpen(true);
            }}
          />
        }
      />
      <ProgressBar value={bar} label={partProgress(locale, safeIndex + 1, Math.max(chapterCount, 1))} />
      <View style={{ flex: 1, width: "100%", maxWidth: 640, alignSelf: "center" }}>
        {loadFailed ? (
          <View style={{ paddingHorizontal: space.xl, paddingBottom: space.sm }}>
            <Notice
              text={message(locale, "loadError")}
              actionLabel={message(locale, "retry")}
              onAction={reloadWords}
            />
          </View>
        ) : null}
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(item) => item.key}
          initialNumToRender={8}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          style={{ flex: 1 }}
          scrollEventThrottle={48}
          onScrollToIndexFailed={(info) => {
            if (scrollRetries.current >= 3) return;
            scrollRetries.current += 1;
            const index = info.index;
            listRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * index),
              animated: false,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0 });
            }, 50);
          }}
          contentContainerStyle={{
            paddingHorizontal: space.xl,
            paddingBottom: Math.max(sheetHeight, space.xxl),
          }}
          ListHeaderComponent={header}
          ListFooterComponent={footer ?? undefined}
          renderItem={({ item, index }) => (
            <SentenceRowView
              row={item}
              index={index}
              activeSentenceId={item.sentence.id === selection.selectedId ? selection.selectedId : null}
              wordIndex={
                item.sentence.id === selection.selectedId && typeof selection.wordIndex === "number"
                  ? selection.wordIndex
                  : null
              }
              onSentence={chooseSentence}
              onWord={chooseWord}
              onLayoutHeight={onLayoutHeight}
              onSentenceNode={onSentenceNode}
              savedWords={savedWords}
            />
          )}
        />
      </View>
      <Sheet
        visible={selected !== undefined}
        label={message(locale, "translation")}
        onClose={dismissSelection}
        onHeight={setSheetHeight}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: sheetLimit }}
          contentContainerStyle={{ gap: space.md }}
        >
          <Text accessibilityRole="header" maxFontSizeMultiplier={uiScaleCap} style={{ color: colors.quiet, fontSize: 13, fontWeight: "700" }}>
            {message(locale, "translation")}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            maxFontSizeMultiplier={0}
            style={{
              color: bannerLine === message(locale, "noTranslation") ? colors.quiet : colors.ink,
              fontFamily: readingFontFamily(settings.readingFont),
              fontSize: Math.max(16, readingMetrics[settings.readingSize].fontSize - 2),
              lineHeight: readingMetrics[settings.readingSize].lineHeight,
            }}
          >
            {bannerLine}
          </Text>
          {screenReader && selected ? (
            <View accessibilityLabel={message(locale, "dictionary")} style={{ gap: space.xs }}>
              {sentenceTokens(selected.en)
                .filter((token) => token.kind === "word" && normalizeWord(token.text) !== "")
                .map((token) =>
                  token.kind === "word" ? (
                    <Pressable
                      key={token.index}
                      accessibilityRole="button"
                      accessibilityLabel={token.text}
                      accessibilityState={{ selected: selection.wordIndex === token.index }}
                      onPress={() => {
                        chooseWord(selected.id, token.index);
                      }}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text style={{ color: colors.ink, fontSize: 16 }}>{token.text}</Text>
                    </Pressable>
                  ) : null,
                )}
            </View>
          ) : null}
          {phoneWord ? (
            <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
              <Text
                maxFontSizeMultiplier={0}
                style={{
                  color: colors.ink,
                  fontFamily: "Literata",
                  fontSize: 20,
                  lineHeight: 26,
                }}
              >
                {normalized}
              </Text>
              <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 22 }}>
                {gloss ?? message(locale, "noDictionaryEntry")}
              </Text>
              {machineLine !== "" ? (
                <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 22 }}>
                  {`${message(locale, "translation")}: ${machineLine}`}
                </Text>
              ) : null}
              {translating ? (
                <Text style={{ color: colors.quiet, fontSize: 15 }}>{message(locale, "translating")}</Text>
              ) : null}
              {translateFailed ? (
                <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 15 }}>
                  {message(locale, "translateFailed")}
                </Text>
              ) : null}
              {explainTranslate ? (
                <View style={{ gap: space.sm }}>
                  <Text style={{ color: colors.ink, fontSize: 15, lineHeight: 21 }}>
                    {message(locale, "translateExplain")}
                  </Text>
                  <Button
                    variant="secondary"
                    label={message(locale, "openInGoogle")}
                    onPress={() => {
                      void openPublicTranslate(normalized, native);
                    }}
                  />
                  <Button
                    variant="quiet"
                    label={message(locale, "addKeyHere")}
                    onPress={() => {
                      router.push("/settings");
                    }}
                  />
                </View>
              ) : null}
              {settings.wordHintSeen ? null : (
                <Text style={{ color: colors.quiet, fontSize: 14 }}>{message(locale, "wordHint")}</Text>
              )}
            </View>
          ) : null}
          {saveFailed ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 15 }}>
              {saveFailedLine(locale)}
            </Text>
          ) : null}
          {speakFailed ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 15 }}>
              {message(locale, "speakFailed")}
            </Text>
          ) : null}
        </ScrollView>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          <IconButton
            icon={speaking ? "square" : "volume-2"}
            label={message(locale, speaking ? "stopSpeech" : "listenSentence")}
            onPress={speakSentence}
          />
          {phoneWord ? (
            <IconButton icon="volume-1" label={message(locale, "listenSentence")} onPress={speakWord} />
          ) : null}
          {phoneWord ? (
            <IconButton
              icon={wordSaved ? "check" : "bookmark"}
              label={message(locale, wordSaved ? "savedWord" : "saveWord")}
              onPress={() => {
                if (selected === undefined || phoneWord.kind !== "word") return;
                if (wordSaved) forgetSurface(phoneWord.text);
                else saveSurface(phoneWord.text, selected);
              }}
            />
          ) : null}
          {phoneWord && normalized !== "" ? (
            <IconButton
              icon="globe"
              label={message(locale, "translateWord")}
              onPress={() => {
                if (selected === undefined || typeof selection.wordIndex !== "number") return;
                translateSurface(phoneWord.text, selected.id, selection.wordIndex);
              }}
            />
          ) : null}
          <IconButton icon="x" label={message(locale, "close")} onPress={dismissSelection} />
        </View>
      </Sheet>
      <Sheet modal visible={partsOpen} onClose={() => setPartsOpen(false)} label={message(locale, "parts")}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={uiScaleCap}
          style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}
        >
          {message(locale, "parts")}
        </Text>
        <FlatList
          data={book.chapters}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 320 }}
          renderItem={({ item, index }) => {
            const checked = index === safeIndex;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                onPress={() => {
                  setPartsOpen(false);
                  onOpenChapter(index);
                }}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ color: checked ? colors.tide : colors.ink, fontWeight: checked ? "700" : "400" }}>
                  {chapterLabel(item.title, index, locale)}
                </Text>
              </Pressable>
            );
          }}
        />
        <View style={{ flexDirection: stackNav ? "column" : "row", gap: space.sm }}>
          <Button
            variant="secondary"
            label={message(locale, "previousPart")}
            disabled={safeIndex === 0}
            onPress={() => {
              setPartsOpen(false);
              onOpenChapter(safeIndex - 1);
            }}
            style={{ flex: stackNav ? undefined : 1 }}
          />
          <Button
            label={message(locale, "nextPart")}
            disabled={safeIndex >= chapterCount - 1}
            onPress={() => {
              setPartsOpen(false);
              onOpenChapter(safeIndex + 1);
            }}
            style={{ flex: stackNav ? undefined : 1 }}
          />
        </View>
      </Sheet>
      <Sheet
        modal
        visible={readingOpen}
        onClose={() => setReadingOpen(false)}
        label={message(locale, "readingSettings")}
      >
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={uiScaleCap}
          style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}
        >
          {message(locale, "readingSettings")}
        </Text>
        <ReadingPreferences />
        <Button
          variant="quiet"
          label={message(locale, "close")}
          onPress={() => {
            setReadingOpen(false);
          }}
        />
      </Sheet>
      {practiceOpen && partPractice !== null ? (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 }}>
          <PracticeSession
            cards={partPractice}
            onClose={() => {
              setPartPractice(null);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
