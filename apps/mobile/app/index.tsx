import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LanguageControls } from "@/components/language-controls";
import { ScreenState } from "@/components/screen-state";
import { fetchBooks } from "@/lib/api";
import { chapterCountLabel, message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { colors, readingFont } from "@/lib/theme";
import type { BookSummary } from "@/lib/types";

function isAbort(reason: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return reason instanceof Error && reason.name === "AbortError";
}

export default function BookListScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const locale = settings.interfaceLocale;
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setBooks(null);
    setError(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchBooks(controller.signal)
      .then((next) => {
        if (!active) return;
        setBooks(next);
        setError(false);
      })
      .catch((reason: unknown) => {
        if (!active || isAbort(reason, controller.signal)) return;
        console.error(reason);
        setBooks(null);
        setError(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "right", "bottom", "left"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand} accessibilityRole="header">
          {message(locale, "appName")}
        </Text>
        <LanguageControls />
        <Text style={styles.heading} accessibilityRole="header">
          {message(locale, "books")}
        </Text>
        {books === null ? (
          <ScreenState locale={locale} error={error} onRetry={retry} />
        ) : books.length === 0 ? (
          <Text style={styles.empty}>{message(locale, "emptyCatalog")}</Text>
        ) : (
          <View style={styles.list}>
            {books.map((book) => (
              <Pressable
                key={book.id}
                accessibilityRole="button"
                onPress={() => {
                  router.push({
                    pathname: "/books/[bookId]",
                    params: { bookId: book.id },
                  });
                }}
                style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
              >
                <Text style={styles.title}>{book.title[locale]}</Text>
                <Text style={styles.author}>{book.author}</Text>
                <Text style={styles.meta}>{chapterCountLabel(locale, book.chapterCount)}</Text>
                <Text style={styles.read}>{message(locale, "read")}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 22,
  },
  brand: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  heading: {
    color: colors.ink,
    fontFamily: readingFont,
    fontSize: 34,
    lineHeight: 40,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
  },
  list: {
    gap: 12,
  },
  card: {
    gap: 4,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  title: {
    color: colors.ink,
    fontFamily: readingFont,
    fontSize: 22,
    lineHeight: 28,
  },
  author: {
    color: colors.muted,
    fontSize: 15,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
  },
  read: {
    marginTop: 8,
    color: colors.accent,
    fontSize: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.75,
  },
});
