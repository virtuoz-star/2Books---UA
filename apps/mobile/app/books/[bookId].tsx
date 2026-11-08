import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { LanguageControls } from "@/components/language-controls";
import { ScreenState } from "@/components/screen-state";
import { fetchBook } from "@/lib/api";
import { message, partLabel, sentenceLabel } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { colors, readingFont } from "@/lib/theme";
import type { BookDetail, Locale, NativeLanguage, Sentence } from "@/lib/types";

function isAbort(reason: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return reason instanceof Error && reason.name === "AbortError";
}

function bookIdFromParams(value: string | string[] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== "string" || id.length === 0) return null;
  return id;
}

function visibleChapterTitle(title: string, index: number, locale: Locale): string {
  const trimmed = title.trim();
  if (trimmed.length > 0) return title;
  return partLabel(locale, index + 1);
}

function nativeText(sentence: Sentence, native: NativeLanguage): string | null {
  const text = sentence[native];
  if (text.trim().length === 0) return null;
  return text;
}

export default function BookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookId?: string | string[] }>();
  const bookId = bookIdFromParams(params.bookId);
  const { settings } = useSettings();
  const locale = settings.interfaceLocale;
  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const retry = useCallback(() => {
    setBook(null);
    setError(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    setChapterIndex(0);
    setSelectedIndex(null);
    if (bookId === null) {
      setBook(null);
      setError(true);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setBook(null);
    setError(false);
    fetchBook(bookId, controller.signal)
      .then((next) => {
        if (!active) return;
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
  }, [attempt, bookId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [chapterIndex, bookId]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const chapterCount = book?.chapters.length ?? 0;
  const safeIndex = chapterCount === 0 ? 0 : Math.min(chapterIndex, chapterCount - 1);
  const chapter = book && chapterCount > 0 ? book.chapters[safeIndex] : null;
  const selected =
    chapter !== null && selectedIndex !== null ? (chapter.sentences[selectedIndex] ?? null) : null;
  const translation = selected === null ? null : nativeText(selected, settings.nativeLanguage);

  const openChapter = (index: number) => {
    if (index === safeIndex) return;
    setChapterIndex(index);
    setSelectedIndex(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} style={styles.scroll}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Text style={styles.backText}>{message(locale, "books")}</Text>
        </Pressable>

        {book === null || chapter === null ? (
          book !== null && chapter === null ? (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {book.title[locale]}
              </Text>
              <Text style={styles.author}>{book.author}</Text>
              <Text style={styles.empty}>{message(locale, "emptyBook")}</Text>
            </>
          ) : (
            <ScreenState locale={locale} error={error || bookId === null} onRetry={retry} />
          )
        ) : (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {book.title[locale]}
            </Text>
            <Text style={styles.author}>{book.author}</Text>
            <LanguageControls />
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={message(locale, "parts")}
              style={styles.chapters}
            >
              {book.chapters.map((item, index) => {
                const selectedChapter = index === safeIndex;
                const label = visibleChapterTitle(item.title, index, locale);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedChapter }}
                    onPress={() => {
                      openChapter(index);
                    }}
                    style={({ pressed }) => [
                      styles.chapterChip,
                      selectedChapter ? styles.chapterChipSelected : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chapterChipText,
                        selectedChapter ? styles.chapterChipTextSelected : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.nav}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: safeIndex === 0 }}
                disabled={safeIndex === 0}
                onPress={() => {
                  openChapter(safeIndex - 1);
                }}
                style={({ pressed }) => [
                  styles.navButton,
                  safeIndex === 0 ? styles.navButtonDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.navText}>{message(locale, "previousPart")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: safeIndex >= chapterCount - 1 }}
                disabled={safeIndex >= chapterCount - 1}
                onPress={() => {
                  openChapter(safeIndex + 1);
                }}
                style={({ pressed }) => [
                  styles.navButton,
                  safeIndex >= chapterCount - 1 ? styles.navButtonDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.navText}>{message(locale, "nextPart")}</Text>
              </Pressable>
            </View>
            <Text style={styles.chapterHeading}>
              {visibleChapterTitle(chapter.title, safeIndex, locale)}
            </Text>
            <View style={styles.sentences}>
              {chapter.sentences.map((sentence, index) => {
                const open = index === selectedIndex;
                const english = sentence.en.trim();
                return (
                  <Pressable
                    key={`${sentence.id}-${index}`}
                    accessibilityRole="togglebutton"
                    accessibilityLabel={
                      english.length > 0 ? sentence.en : sentenceLabel(locale, index + 1)
                    }
                    accessibilityState={{ checked: open }}
                    onPress={() => {
                      setSelectedIndex((current) => (current === index ? null : index));
                    }}
                    style={({ pressed }) => [
                      styles.sentence,
                      open ? styles.sentenceSelected : null,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={[styles.sentenceText, open ? styles.sentenceTextSelected : null]}>
                      {sentence.en}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {chapter === null ? null : (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          {selected === null ? (
            <Text style={styles.hint}>{message(locale, "hint")}</Text>
          ) : (
            <>
              <Text style={styles.panelLabel}>{message(locale, "translation")}</Text>
              <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
                <Text style={translation === null ? styles.missing : styles.translation}>
                  {translation ?? message(locale, "noTranslation")}
                </Text>
              </ScrollView>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  back: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  backText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  title: {
    color: colors.ink,
    fontFamily: readingFont,
    fontSize: 32,
    lineHeight: 38,
  },
  author: {
    color: colors.muted,
    fontSize: 16,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
  },
  chapters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chapterChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chapterChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chapterChipText: {
    color: colors.ink,
    fontSize: 15,
  },
  chapterChipTextSelected: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  nav: {
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  chapterHeading: {
    color: colors.ink,
    fontFamily: readingFont,
    fontSize: 22,
    lineHeight: 28,
  },
  sentences: {
    gap: 8,
  },
  sentence: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  sentenceSelected: {
    backgroundColor: colors.accentSoft,
  },
  sentenceText: {
    color: colors.ink,
    fontFamily: readingFont,
    fontSize: 20,
    lineHeight: 30,
  },
  sentenceTextSelected: {
    textDecorationLine: "underline",
    textDecorationColor: colors.accent,
  },
  panel: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 6,
  },
  panelLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  panelScroll: {
    flexGrow: 0,
    maxHeight: 180,
  },
  panelContent: {
    paddingBottom: 4,
  },
  hint: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  translation: {
    color: colors.ink,
    fontFamily: readingFont,
    fontSize: 18,
    lineHeight: 26,
  },
  missing: {
    color: colors.muted,
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.75,
  },
});
