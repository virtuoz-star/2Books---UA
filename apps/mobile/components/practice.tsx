import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Platform, Text, View, type HostInstance } from "react-native";

import { Button, IconButton, TopBar } from "@/components/ui";
import { message, practiceLeftLine, practiceSummaryLine } from "@/lib/messages";
import {
  answerPractice,
  practiceAnswerText,
  practiceSummary,
  revealPractice,
  startPractice,
  type PracticeCard,
} from "@/lib/practice";
import { useSettings } from "@/lib/settings";
import { space, useTheme } from "@/lib/theme";
import { normalizeWord } from "#/dictionary/lookup";
import { sentenceTokens } from "#/reader/tokens";

function moveFocus(node: HostInstance | null): void {
  if (node === null) return;
  AccessibilityInfo.sendAccessibilityEvent(node, "focus");
}

function emphasized(sentence: string, word: string) {
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

export function PracticeSession({
  cards,
  onClose,
}: {
  cards: readonly PracticeCard[];
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const locale = settings.interfaceLocale;
  const [state, setState] = useState(() => startPractice(cards));
  const wordRef = useRef<HostInstance>(null);
  const answerRef = useRef<HostInstance>(null);
  const againRef = useRef<HostInstance>(null);
  const summaryRef = useRef<HostInstance>(null);
  const summary = practiceSummary(state);
  const card = state.queue[0] ?? null;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      onCloseRef.current();
      return true;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      void Speech.stop().catch(() => {
        console.error("speech");
      });
    };
  }, []);

  useEffect(() => {
    if (card === null) {
      void Speech.stop().catch(() => {
        // A stop with nothing playing is not a failure.
      });
      return;
    }
    if (state.revealed) return;
    void Speech.stop().catch(() => {
      // A stop with nothing playing is not a failure.
    });
    moveFocus(wordRef.current);
  }, [card, state.revealed]);

  useEffect(() => {
    if (!state.revealed || card === null) return;
    const answer = practiceAnswerText(card);
    moveFocus(answer === "" ? againRef.current : answerRef.current);
  }, [card, state.revealed]);

  useEffect(() => {
    if (!summary.done) return;
    moveFocus(summaryRef.current);
  }, [summary.done]);

  const listen = () => {
    if (card === null || card.word.trim() === "") return;
    const text = card.word;
    void (async () => {
      try {
        await Speech.stop();
      } catch {
        console.error("speech");
      }
      try {
        Speech.speak(text, {
          language: Platform.OS === "android" ? "en" : "en-US",
          rate: 0.75,
          pitch: 1,
        });
      } catch {
        console.error("speech");
      }
    })();
  };

  const againLabel = message(locale, "againCard");

  return (
    <View style={{ flex: 1, backgroundColor: colors.blotter }} accessibilityViewIsModal>
      <TopBar
        title={message(locale, "practice")}
        leading={<IconButton icon="x" label={message(locale, "practiceLeave")} onPress={onClose} />}
      />
      <View style={{ flex: 1, justifyContent: "center", padding: space.xl, gap: space.lg }}>
        {summary.done || card === null ? (
          <View style={{ gap: space.md }}>
            <Text
              ref={summaryRef}
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 22, lineHeight: 30 }}
            >
              {practiceSummaryLine(locale, summary.cards, summary.again)}
            </Text>
            {summary.missed.length > 0 ? (
              <Button
                label={message(locale, "practiceMissed")}
                onPress={() => {
                  setState(startPractice(summary.missed));
                }}
              />
            ) : null}
            <Button variant="quiet" label={message(locale, "practiceLeave")} onPress={onClose} />
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <Text
              ref={wordRef}
              accessibilityRole="header"
              accessibilityLanguage="en"
              maxFontSizeMultiplier={0}
              style={{ color: colors.ink, fontFamily: "Literata", fontSize: 36, lineHeight: 44 }}
            >
              {card.word}
            </Text>
            {card.sentenceEn === "" ? null : (
              <Text
                accessibilityLanguage="en"
                maxFontSizeMultiplier={0}
                style={{ color: colors.quiet, fontSize: 18, lineHeight: 28 }}
              >
                {emphasized(card.sentenceEn, card.word)}
              </Text>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <IconButton icon="volume-2" label={message(locale, "listenSentence")} onPress={listen} />
              <Text style={{ color: colors.quiet, fontSize: 15 }}>{practiceLeftLine(locale, state.queue.length)}</Text>
            </View>
            {state.revealed ? (
              <View style={{ gap: space.md }}>
                <View
                  ref={answerRef}
                  accessible
                  accessibilityLabel={practiceAnswerText(card)}
                  accessibilityLanguage={card.nativeLanguage}
                  style={{ gap: space.sm }}
                >
                  <Text
                    maxFontSizeMultiplier={0}
                    style={{ color: colors.ink, fontSize: 22, lineHeight: 30 }}
                  >
                    {card.gloss.trim() === "" ? "—" : card.gloss.trim()}
                  </Text>
                  {card.sentenceNative.trim() === "" ? null : (
                    <Text
                      maxFontSizeMultiplier={0}
                      style={{ color: colors.ink, fontSize: 18, lineHeight: 28 }}
                    >
                      {card.sentenceNative.trim()}
                    </Text>
                  )}
                </View>
                <Button
                  ref={againRef}
                  variant="secondary"
                  label={againLabel}
                  onPress={() => {
                    setState((current) => answerPractice(current, "again"));
                  }}
                />
                <Button
                  label={message(locale, "knowCard")}
                  onPress={() => {
                    setState((current) => answerPractice(current, "know"));
                  }}
                />
              </View>
            ) : (
              <Button
                label={message(locale, "showAnswer")}
                onPress={() => {
                  setState((current) => revealPractice(current));
                }}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}
