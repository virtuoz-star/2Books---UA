import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";

import { Button } from "#/components/ui/button";
import { IconButton } from "#/components/ui/icon-button";
import {
  answerFlashCard,
  flashSummary,
  revealFlashCard,
  startFlashSession,
  type FlashCard,
  type FlashSession,
} from "#/dictionary/flashcards";
import { message, practiceSummaryLabel } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";

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

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.75;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export function FlashcardsPanel({
  locale,
  nativeLanguage,
  cards,
  onLeave,
}: {
  locale: Locale;
  nativeLanguage: NativeLanguage;
  cards: readonly FlashCard[];
  onLeave: () => void;
}) {
  const [session, setSession] = useState<FlashSession>(() => startFlashSession(cards));
  const answersRef = useRef<HTMLDivElement>(null);
  const summary = flashSummary(session);
  const current = session.queue[0];

  useEffect(() => {
    if (!session.revealed) return;
    answersRef.current?.querySelector("button")?.focus();
  }, [session.revealed, current?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") {
        onLeave();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        setSession((currentSession) => revealFlashCard(currentSession));
        return;
      }
      if (event.key === "1") setSession((currentSession) => answerFlashCard(currentSession, "again"));
      if (event.key === "2") setSession((currentSession) => answerFlashCard(currentSession, "know"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  if (summary.done || current === undefined) {
    return (
      <section className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-5">
        <p className="text-foreground">{practiceSummaryLabel(locale, summary.total, summary.again)}</p>
        {session.missed.length > 0 ? (
          <Button
            type="button"
            onClick={() => setSession(startFlashSession(session.missed))}
          >
            {message(locale, "practiceMissed")}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" onClick={onLeave}>
          {message(locale, "practiceLeave")}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p lang="en" className="text-2xl font-medium text-foreground">
          {current.word}
        </p>
        <IconButton label={message(locale, "listenSentence")} onClick={() => speak(current.word)}>
          <Volume2 className="size-4" aria-hidden />
        </IconButton>
      </div>
      {current.sentenceEn ? (
        <p lang="en" className="text-foreground">
          {emphasize(current.sentenceEn, current.word)}
        </p>
      ) : null}
      {session.revealed ? (
        <div ref={answersRef} className="flex flex-col gap-3">
          <p lang={nativeLanguage} className="text-lg text-foreground">
            {current.gloss || "—"}
          </p>
          {current.sentenceNative ? (
            <p lang={nativeLanguage} className="text-sm text-muted-foreground">
              {current.sentenceNative}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setSession(answerFlashCard(session, "again"))}>
              {message(locale, "practiceAgain")}
            </Button>
            <Button type="button" onClick={() => setSession(answerFlashCard(session, "know"))}>
              {message(locale, "practiceKnow")}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" onClick={() => setSession(revealFlashCard(session))}>
          {message(locale, "practiceShow")}
        </Button>
      )}
      <Button type="button" variant="link" onClick={onLeave}>
        {message(locale, "practiceLeave")}
      </Button>
    </section>
  );
}
