import { Volume2, X } from "lucide-react";

import { Button } from "#/components/ui/button";
import { IconButton } from "#/components/ui/icon-button";
import { Notice } from "#/components/ui/notice";
import { message, shownLanguageLabel, translationStatus } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";

export function StudyPanel({
  locale,
  nativeLanguage,
  translation,
  word,
  gloss,
  googleText,
  translating,
  translateFailed,
  speakFailed,
  speaking,
  speechReady,
  wordSaved,
  deviceError,
  googleKey,
  googleUrl,
  onListen,
  onSpeakWord,
  onClose,
  onToggleSave,
  onRetryTranslate,
}: {
  locale: Locale;
  nativeLanguage: NativeLanguage;
  translation: { text: string; lang: NativeLanguage } | null;
  word: string | null;
  gloss: string | null;
  googleText: string | null;
  translating: boolean;
  translateFailed: boolean;
  speakFailed: boolean;
  speaking: boolean;
  speechReady: boolean;
  wordSaved: boolean;
  deviceError: boolean;
  googleKey: boolean;
  googleUrl: string;
  onListen: () => void;
  onSpeakWord: () => void;
  onClose: () => void;
  onToggleSave: () => void;
  onRetryTranslate: () => void;
}) {
  return (
    <aside
      id="study-panel"
      className="study-dock"
      aria-label={
        translation ? translationStatus(locale, translation.text) : message(locale, "translation")
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{message(locale, "translation")}</p>
        <div className="flex items-center">
          {speechReady ? (
            <IconButton
              label={message(locale, speaking ? "stopSpeech" : "listenSentence")}
              aria-pressed={speaking}
              aria-keyshortcuts="L"
              onClick={onListen}
            >
              <Volume2 className="size-4" aria-hidden />
            </IconButton>
          ) : null}
          <IconButton label={message(locale, "closePanel")} onClick={onClose}>
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>
      {translation && translation.lang !== nativeLanguage ? (
        <p className="text-xs text-muted-foreground">{shownLanguageLabel(locale, translation.lang)}</p>
      ) : null}
      {translation ? (
        <p lang={translation.lang} className="reading-text text-base text-foreground">
          {translation.text}
        </p>
      ) : null}
      {word ? (
        <div className="mt-3 flex flex-col gap-2">
          <p className="flex items-center gap-1">
            <span lang="en" className="text-2xl font-medium text-foreground">
              {word}
            </span>
            {speechReady ? (
              <IconButton label={message(locale, "listenSentence")} onClick={onSpeakWord}>
                <Volume2 className="size-4" aria-hidden />
              </IconButton>
            ) : null}
          </p>
          <p lang={gloss ? nativeLanguage : locale} className="text-foreground">
            {gloss ?? message(locale, "noDictionaryEntry")}
          </p>
          {googleText ? (
            <p lang={nativeLanguage} className="text-foreground">
              {googleText}
            </p>
          ) : null}
          {translating ? <p className="text-sm text-muted-foreground">{message(locale, "translating")}</p> : null}
          {translateFailed ? <Notice tone="danger">{message(locale, "translateFailed")}</Notice> : null}
          {googleKey && translateFailed ? (
            <Button type="button" variant="link" onClick={onRetryTranslate}>
              {message(locale, "translateWord")}
            </Button>
          ) : null}
          {googleKey ? null : (
            <>
              <a className="text-sm font-medium text-primary underline" href={googleUrl} target="_blank" rel="noopener noreferrer">
                {message(locale, "openInGoogle")}
              </a>
              <p className="text-sm text-muted-foreground">{message(locale, "translateBookNeedKey")}</p>
            </>
          )}
          <Button
            type="button"
            variant={wordSaved ? "secondary" : "primary"}
            aria-pressed={wordSaved}
            aria-keyshortcuts="S"
            aria-label={message(locale, wordSaved ? "removeWord" : "saveWord")}
            onClick={onToggleSave}
          >
            {wordSaved ? `✓ ${message(locale, "savedWord")}` : message(locale, "saveWord")}
          </Button>
        </div>
      ) : null}
      {speakFailed ? <Notice tone="danger">{message(locale, "speakFailed")}</Notice> : null}
      {deviceError ? <Notice tone="danger">{message(locale, "couldNotSave")}</Notice> : null}
      <p className="mt-3 text-xs text-muted-foreground">{message(locale, "shortcuts")}</p>
    </aside>
  );
}
