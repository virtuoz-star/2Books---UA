import { useEffect, useState, type FormEvent } from "react";

import { Button } from "#/components/ui/button";
import { Field, Input } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { readGoogleTranslateKey, writeGoogleTranslateKey } from "#/dictionary/google-key";
import { postGoogleTranslate } from "#/dictionary/google-request";
import { maxGoogleKeyLength } from "#/dictionary/google-translate";
import { message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";

function maskKey(key: string): string {
  const tail = key.slice(-4);
  return `•••• ${tail}`;
}

export function GoogleKeyForm({ locale }: { locale: Locale }) {
  const [stored, setStored] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState("");
  const [tooLong, setTooLong] = useState(false);
  const [deviceError, setDeviceError] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<"works" | "rejected" | "failed" | null>(null);

  useEffect(() => {
    const sync = () => setStored(readGoogleTranslateKey());
    sync();
    window.addEventListener("2books-google-key", sync);
    return () => window.removeEventListener("2books-google-key", sync);
  }, []);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > maxGoogleKeyLength) {
      setTooLong(true);
      return;
    }
    if (!writeGoogleTranslateKey(trimmed)) {
      setDeviceError(true);
      return;
    }
    setDraft("");
    setTooLong(false);
    setDeviceError(false);
    setReplacing(false);
    setTestState(null);
    setStored(trimmed);
  };

  const clear = () => {
    if (!writeGoogleTranslateKey("")) {
      setDeviceError(true);
      return;
    }
    setDraft("");
    setTooLong(false);
    setDeviceError(false);
    setReplacing(false);
    setTestState(null);
    setStored("");
  };

  const testKey = () => {
    const key = readGoogleTranslateKey();
    if (key.length === 0 || testing) return;
    setTesting(true);
    setTestState(null);
    const controller = new AbortController();
    void postGoogleTranslate({
      key,
      q: ["hello"],
      target: "uk",
      signal: controller.signal,
      timeoutMs: 15_000,
    }).then((result) => {
      setTesting(false);
      if (!result.ok) {
        setTestState(result.status === 401 || result.status === 403 ? "rejected" : "failed");
        return;
      }
      setTestState(result.rows[0]?.text ? "works" : "failed");
    });
  };

  const showField = stored.length === 0 || replacing;

  return (
    <form
      className="flex flex-col items-start gap-2"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        save();
      }}
    >
      <p className="text-sm text-muted-foreground">{message(locale, "googleKeyHelp")}</p>
      {stored.length > 0 && !replacing ? (
        <p className="text-sm text-foreground">
          {message(locale, "googleKeySaved")} <span className="font-mono">{maskKey(stored)}</span>
        </p>
      ) : null}
      {deviceError ? <Notice tone="danger">{message(locale, "couldNotSave")}</Notice> : null}
      {testState === "works" ? <Notice tone="success">{message(locale, "googleKeyWorks")}</Notice> : null}
      {testState === "rejected" ? (
        <Notice tone="danger">{message(locale, "googleKeyRejected")}</Notice>
      ) : null}
      {testState === "failed" ? <Notice tone="danger">{message(locale, "translateFailed")}</Notice> : null}
      {showField ? (
        <Field
          id="google-translate-key"
          label={message(locale, "googleKeyLabel")}
          hint={message(locale, "googleKeyHint")}
          error={tooLong ? message(locale, "googleKeyTooLong") : undefined}
          className="w-full max-w-sm"
        >
          <Input
            name="google-translate-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setTooLong(false);
            }}
          />
        </Field>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {showField ? (
          <Button type="submit" disabled={draft.trim().length === 0}>
            {message(locale, "googleKeySave")}
          </Button>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setReplacing(true)}>
            {message(locale, "googleKeyReplace")}
          </Button>
        )}
        {stored.length > 0 ? (
          <Button type="button" variant="secondary" busy={testing} onClick={testKey}>
            {message(locale, "googleKeyTest")}
          </Button>
        ) : null}
        {stored.length > 0 ? (
          <Button type="button" variant="link" onClick={clear}>
            {message(locale, "googleKeyClear")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
