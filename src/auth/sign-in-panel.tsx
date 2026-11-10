import { useState } from "react";

import { Button } from "#/components/ui/button";
import { Notice } from "#/components/ui/notice";
import { message } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.4 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function SignInPanel({
  locale,
  nativeLanguage,
  ready,
  authError,
  redirectTo,
}: {
  locale: Locale;
  nativeLanguage: NativeLanguage;
  ready: boolean;
  authError: boolean;
  redirectTo?: string;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onGoogle() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const { signInWithGoogle } = await import("#/auth/client");
      const result = await signInWithGoogle(nativeLanguage, redirectTo);
      if (result.error) {
        setFailed(true);
        setPending(false);
      }
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6">
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        <li>{message(locale, "signInPlace")}</li>
        <li>{message(locale, "signInWords")}</li>
        <li>{message(locale, "signInTexts")}</li>
      </ul>
      <p className="text-sm text-muted-foreground">{message(locale, "signInPrivacy")}</p>
      {ready ? (
        <Button type="button" className="w-full" busy={pending} onClick={() => void onGoogle()}>
          <GoogleMark />
          {message(locale, pending ? "signInRedirecting" : "signInWithGoogle")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Notice tone="warning">{message(locale, "googleNotConfigured")}</Notice>
          <a className="text-sm font-medium text-primary underline" href="/">
            {message(locale, "backToBooks")}
          </a>
        </div>
      )}
      {failed || authError ? (
        <Notice tone="danger">{message(locale, "googleSignInFailed")}</Notice>
      ) : null}
    </div>
  );
}
