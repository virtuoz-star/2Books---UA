import { File, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Share, Text, TextInput, View } from "react-native";

import { PracticeSession } from "@/components/practice";
import { Button, EmptyState, IconButton, Notice, Screen, Segmented, Sheet, TopBar, useSnackbar } from "@/components/ui";
import { ankiDeck, type SavedWord } from "#/dictionary/saved-words";
import { normalizeWord } from "#/dictionary/lookup";
import { sentenceTokens } from "#/reader/tokens";
import {
  exportedCountLabel,
  languageName,
  message,
  savedCountLabel,
  wordsOtherLine,
} from "@/lib/messages";
import { forgetWord, loadSavedWords, rememberWord, subscribeSavedWords } from "@/lib/saved-words-store";
import { useSettings } from "@/lib/settings";
import { radius, space, useTheme } from "@/lib/theme";
import { nativeLanguages, type NativeLanguage } from "@/lib/types";

async function shareAnki(text: string): Promise<void> {
  const file = new File(Paths.cache, "2books-words.txt");
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  await file.write(text);
  try {
    const sharing = await import("expo-sharing");
    if (await sharing.isAvailableAsync()) {
      await sharing.shareAsync(file.uri, {
        mimeType: "text/plain",
        dialogTitle: "Anki",
        UTI: "public.plain-text",
      });
      return;
    }
  } catch {
    // Expo Go does not ship the native share module. Fall through to text share.
  }
  await Share.share({ message: text });
}

function emphasize(sentence: string, word: string) {
  const normalized = normalizeWord(word);
  if (normalized === "") return sentence;
  let marked = false;
  const parts = sentenceTokens(sentence).map((token, index) => {
    const match = token.kind === "word" && !marked && normalizeWord(token.text) === normalized;
    if (match) marked = true;
    return (
      <Text key={index} style={match ? { fontFamily: "Literata-SemiBold" } : undefined}>
        {token.text}
      </Text>
    );
  });
  if (!marked) return sentence;
  return <Text>{parts}</Text>;
}

const WordRow = memo(function WordRow({
  word,
  onRemove,
  onListen,
  onOpen,
}: {
  word: SavedWord;
  onRemove: (word: SavedWord) => void;
  onListen: (word: SavedWord) => void;
  onOpen: (word: SavedWord) => void;
}) {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const locale = settings.interfaceLocale;
  return (
    <View
      style={{
        gap: space.xs,
        paddingVertical: space.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.mist,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text
          maxFontSizeMultiplier={0}
          style={{ flex: 1, color: colors.ink, fontFamily: "Literata", fontSize: 20, lineHeight: 26 }}
        >
          {word.word}
        </Text>
        <IconButton
          icon="volume-2"
          label={message(locale, "listenSentence")}
          onPress={() => {
            onListen(word);
          }}
        />
        <IconButton
          icon="trash-2"
          label={message(locale, "removeWord")}
          onPress={() => {
            onRemove(word);
          }}
        />
      </View>
      {word.gloss === "" ? null : (
        <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 22 }}>{word.gloss}</Text>
      )}
      {word.sentenceEn === "" ? null : (
        <Text style={{ color: colors.quiet, fontSize: 14, lineHeight: 20 }}>{emphasize(word.sentenceEn, word.word)}</Text>
      )}
      {word.sentenceNative === "" ? null : (
        <Text style={{ color: colors.quiet, fontSize: 14, lineHeight: 20 }}>{word.sentenceNative}</Text>
      )}
      {word.bookId !== "" && word.bookSource !== "" ? (
        <Button variant="quiet" label={message(locale, "openInBook")} onPress={() => onOpen(word)} />
      ) : null}
    </View>
  );
});

export default function WordsScreen() {
  const router = useRouter();
  const { settings, patchSettings } = useSettings();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const locale = settings.interfaceLocale;
  const native = settings.nativeLanguage;
  const [words, setWords] = useState<SavedWord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [filter, setFilter] = useState<NativeLanguage>(native);
  const [practiceOpen, setPracticeOpen] = useState(false);

  useEffect(() => {
    setFilter(native);
  }, [native]);

  const refresh = useCallback(async () => {
    try {
      setWords(await loadSavedWords());
      setLoadFailed(false);
    } catch (reason: unknown) {
      console.error(reason);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeSavedWords(() => {
      void refresh();
    });
  }, [refresh]);

  const counts = useMemo(() => {
    const totals = { uk: 0, ru: 0 };
    for (const word of words ?? []) totals[word.nativeLanguage] += 1;
    return totals;
  }, [words]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (words ?? []).filter((word) => {
      if (word.nativeLanguage !== filter) return false;
      if (needle === "") return true;
      return (
        word.word.toLowerCase().includes(needle) ||
        word.gloss.toLowerCase().includes(needle) ||
        word.sentenceEn.toLowerCase().includes(needle) ||
        word.sentenceNative.toLowerCase().includes(needle)
      );
    });
  }, [filter, query, words]);

  const other = filter === "uk" ? "ru" : "uk";
  const otherCount = counts[other];
  const practiceCards = useMemo(
    () => (words ?? []).filter((word) => word.nativeLanguage === filter),
    [filter, words],
  );

  const remove = useCallback(
    (word: SavedWord) => {
      void (async () => {
        try {
          await forgetWord(word.word, word.nativeLanguage);
          snackbar.show(message(locale, "wordRemoved"), {
            label: message(locale, "undo"),
            onPress: () => {
              void rememberWord({
                word: word.word,
                gloss: word.gloss,
                nativeLanguage: word.nativeLanguage,
                sentence: { en: word.sentenceEn, native: word.sentenceNative },
              });
            },
          });
        } catch (reason: unknown) {
          console.error(reason);
        }
      })();
    },
    [locale, snackbar],
  );

  const listen = useCallback((word: SavedWord) => {
    Speech.speak(word.word, { language: "en-US", rate: 0.75 });
  }, []);

  const openPlace = useCallback(
    (word: SavedWord) => {
      router.push({
        pathname: word.bookSource === "local" ? "/local/[bookId]" : "/books/[bookId]",
        params: {
          bookId: word.bookId,
          chapterId: word.chapterId,
          sentenceId: word.sentenceId,
        },
      });
    },
    [router],
  );

  const share = () => {
    if (sharing || visible.length === 0) return;
    setSharing(true);
    const count = visible.length;
    void (async () => {
      try {
        await shareAnki(ankiDeck(visible));
        setShareFailed(false);
        setExportOpen(false);
        snackbar.show(exportedCountLabel(locale, count));
      } catch {
        console.error("anki-export", "io");
        setShareFailed(true);
      } finally {
        setSharing(false);
      }
    })();
  };

  return (
    <Screen>
      <TopBar
        title={message(locale, "savedWords")}
        subtitle={words === null ? undefined : savedCountLabel(locale, counts[filter])}
        trailing={
          <IconButton
            icon="share"
            label={message(locale, "exportAnki")}
            disabled={sharing || visible.length === 0}
            onPress={() => {
              setExportOpen(true);
            }}
          />
        }
      />
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.sm }}>
        <Button
          label={message(locale, "practice")}
          disabled={practiceCards.length === 0}
          onPress={() => {
            void Speech.stop();
            setPracticeOpen(true);
          }}
        />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(word) => `${word.nativeLanguage}:${word.word}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl }}
        initialNumToRender={12}
        windowSize={8}
        renderItem={({ item }) => <WordRow word={item} onRemove={remove} onListen={listen} onOpen={openPlace} />}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingTop: space.sm, paddingBottom: space.md }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={message(locale, "wordsSearch")}
              placeholderTextColor={colors.faint}
              accessibilityLabel={message(locale, "wordsSearch")}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                minHeight: 44,
                borderWidth: 1,
                borderColor: colors.edge,
                borderRadius: radius.md,
                paddingHorizontal: space.md,
                color: colors.ink,
                backgroundColor: colors.paper,
              }}
            />
            <Segmented
              label={message(locale, "nativeLanguage")}
              value={filter}
              options={nativeLanguages.map((language) => ({
                value: language,
                label: `${languageName(locale, language)} ${counts[language]}`,
              }))}
              onChange={setFilter}
            />
            {loadFailed ? (
              <Notice text={message(locale, "loadError")} actionLabel={message(locale, "retry")} onAction={() => void refresh()} />
            ) : null}
            {shareFailed ? <Notice text={message(locale, "shareFailed")} /> : null}
          </View>
        }
        ListEmptyComponent={
          words === null ? (
            <Text style={{ color: colors.quiet, fontSize: 16 }}>{message(locale, "loading")}</Text>
          ) : visible.length === 0 && query.trim() === "" && otherCount > 0 ? (
            <EmptyState
              text={wordsOtherLine(locale, languageName(locale, filter), languageName(locale, other), otherCount)}
              action={
                <Button
                  label={message(locale, "switchLanguage")}
                  onPress={() => {
                    setFilter(other);
                    patchSettings({ nativeLanguage: other });
                  }}
                />
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState text={message(locale, "wordsEmpty")} />
          ) : undefined
        }
      />
      <Sheet
        modal
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        label={message(locale, "exportAnki")}
      >
        <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>
          {message(locale, "exportAnki")}
        </Text>
        <Text style={{ color: colors.quiet, fontSize: 16, lineHeight: 22 }}>{message(locale, "ankiHint")}</Text>
        <Text style={{ color: colors.ink, fontSize: 16 }}>{savedCountLabel(locale, visible.length)}</Text>
        <Button label={message(locale, "exportAnki")} disabled={sharing || visible.length === 0} onPress={share} />
        <Button variant="quiet" label={message(locale, "close")} onPress={() => setExportOpen(false)} />
      </Sheet>
      {practiceOpen ? (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 }}>
          <PracticeSession
            cards={practiceCards}
            onClose={() => {
              setPracticeOpen(false);
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
}
