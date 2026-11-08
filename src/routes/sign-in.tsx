import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { googleSignInReady } from "#/auth/session";
import { message } from "#/i18n/messages";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { useNativeLanguage } from "#/shell/app-header";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { error?: string } => {
    if (typeof search.error !== "string" || search.error.length < 1 || search.error.length > 200) {
      return {};
    }
    return { error: search.error };
  },
  loader: () => googleSignInReady(),
  component: SignInPage,
});

const buttonClass =
  "cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-default disabled:opacity-60";

function SignInPage() {
  const ready = Route.useLoaderData();
  const { error: authError } = Route.useSearch();
  const { settings } = useReaderSettings();
  const nativeLanguage = useNativeLanguage();
  const locale = settings.interfaceLocale;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onGoogle() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      // Imported on click. A static import pulls a second React into the server render.
      const { signInWithGoogle } = await import("#/auth/client");
      const result = await signInWithGoogle(nativeLanguage);
      if (result.error) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">{message(locale, "signIn")}</h1>
      {ready ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => void onGoogle()}
          className={buttonClass}
        >
          {message(locale, "signInWithGoogle")}
        </button>
      ) : (
        <p className="text-base text-foreground">{message(locale, "googleNotConfigured")}</p>
      )}
      {failed || authError ? (
        <p role="alert" className="text-sm text-foreground">
          {message(locale, "googleSignInFailed")}
        </p>
      ) : null}
    </main>
  );
}
