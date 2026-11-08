import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import type { AuthResult } from "#/auth/session";
import { signUp } from "#/auth/session";
import { languageName, message } from "#/i18n/messages";
import type { NativeLanguage } from "#/i18n/types";
import { useReaderSettings } from "#/reader/use-reader-settings";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

const nativeLanguages = ["uk", "ru"] as const satisfies readonly NativeLanguage[];

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const buttonClass =
  "cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground";

type AuthError = Extract<AuthResult, { ok: false }>["error"];

function signUpMessage(
  locale: Parameters<typeof message>[0],
  error: AuthError | null,
): string | null {
  if (error === "email-taken") return message(locale, "emailTaken");
  if (error === "invalid-input") return message(locale, "invalidInput");
  return null;
}

function SignUpPage() {
  const navigate = useNavigate();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [chosenLanguage, setChosenLanguage] = useState<NativeLanguage | null>(null);
  const nativeLanguage = chosenLanguage ?? settings.nativeLanguage;
  const [error, setError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);
  const errorMessage = signUpMessage(locale, error);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await signUp({ data: { email, password, nativeLanguage } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setError("invalid-input");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">{message(locale, "signUp")}</h1>
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            {message(locale, "email")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            {message(locale, "password")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="account-native-language" className="text-sm font-medium text-foreground">
            {message(locale, "nativeLanguage")}
          </label>
          <select
            id="account-native-language"
            name="nativeLanguage"
            value={nativeLanguage}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "uk" || next === "ru") setChosenLanguage(next);
            }}
            className={fieldClass}
          >
            {nativeLanguages.map((language) => (
              <option key={language} value={language}>
                {languageName(locale, language)}
              </option>
            ))}
          </select>
        </div>
        {errorMessage ? (
          <p role="alert" className="text-sm text-foreground">
            {errorMessage}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClass}>
          {message(locale, "signUp")}
        </button>
      </form>
      <Link to="/sign-in" className="text-sm text-foreground underline">
        {message(locale, "haveAccount")}
      </Link>
    </main>
  );
}
