import { getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { signOut, updateNativeLanguage, type CurrentUser } from "#/auth/session";
import { languageName, message } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import { useReaderSettings } from "#/reader/use-reader-settings";

const interfaceLocales = ["uk", "ru", "en"] as const satisfies readonly Locale[];
const nativeLanguages = ["uk", "ru"] as const satisfies readonly NativeLanguage[];

const rootRoute = getRouteApi("__root__");

type ReadingLanguage = {
  nativeLanguage: NativeLanguage;
  setNativeLanguage: (nativeLanguage: NativeLanguage) => void;
};

const ReadingLanguageContext = createContext<ReadingLanguage | null>(null);

export function useNativeLanguage(): NativeLanguage {
  const reading = useContext(ReadingLanguageContext);
  const { settings } = useReaderSettings();
  return reading?.nativeLanguage ?? settings.nativeLanguage;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = rootRoute.useRouteContext();
  const { settings } = useReaderSettings();

  useEffect(() => {
    // Server html lang stays uk. After mount, follow the interface locale.
    document.documentElement.lang = settings.interfaceLocale;
  }, [settings.interfaceLocale]);

  return (
    <ReadingLanguageProvider user={user}>
      <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-10 px-6 py-10 sm:py-14">
        <AppHeader user={user} />
        {children}
      </div>
    </ReadingLanguageProvider>
  );
}

function ReadingLanguageProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const { settings, updateSettings } = useReaderSettings();
  const [override, setOverride] = useState<NativeLanguage | null>(null);
  const nativeLanguage = user ? (override ?? user.nativeLanguage) : settings.nativeLanguage;

  useEffect(() => {
    if (override !== null && user !== null && user.nativeLanguage === override) {
      setOverride(null);
    }
  }, [override, user]);

  const setNativeLanguage = (next: NativeLanguage) => {
    updateSettings({ ...settings, nativeLanguage: next });
    if (user === null) return;
    setOverride(next);
    try {
      const pending = updateNativeLanguage({ data: { nativeLanguage: next } });
      void Promise.resolve(pending)
        .then(() => router.invalidate())
        .catch(() => {
          // The account copy failed. The control still shows the chosen language.
        });
    } catch {
      // Ignore a failed native-language write.
    }
  };

  return (
    <ReadingLanguageContext.Provider value={{ nativeLanguage, setNativeLanguage }}>
      {children}
    </ReadingLanguageContext.Provider>
  );
}

function AppHeader({ user }: { user: CurrentUser | null }) {
  const router = useRouter();
  const { settings, updateSettings } = useReaderSettings();
  const reading = useContext(ReadingLanguageContext);
  const locale = settings.interfaceLocale;
  const nativeLanguage = reading?.nativeLanguage ?? settings.nativeLanguage;

  const onSignOut = () => {
    void (async () => {
      try {
        await signOut();
      } catch {
        return;
      }
      try {
        await router.invalidate();
      } catch {
        // The next load reads the session again.
      }
    })();
  };

  return (
    <header className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="text-lg font-semibold text-foreground no-underline">
          {message(locale, "appName")}
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link to="/upload" className="font-medium text-foreground">
            {message(locale, "uploadTitle")}
          </Link>
          {user === null ? (
            <Link to="/sign-in" className="font-medium text-foreground">
              {message(locale, "signIn")}
            </Link>
          ) : (
            <>
              <span className="max-w-full break-all text-muted-foreground">{user.email}</span>
              <button
                type="button"
                onClick={onSignOut}
                className="cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                {message(locale, "signOut")}
              </button>
            </>
          )}
        </nav>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <LanguageSelect
          id="interface-language"
          label={message(locale, "interfaceLanguage")}
          value={settings.interfaceLocale}
          options={interfaceLocales}
          locale={locale}
          onChange={(interfaceLocale) => {
            updateSettings({ ...settings, interfaceLocale });
          }}
        />
        <LanguageSelect
          id="native-language"
          label={message(locale, "nativeLanguage")}
          value={nativeLanguage}
          options={nativeLanguages}
          locale={locale}
          onChange={(next) => {
            if (reading) reading.setNativeLanguage(next);
            else updateSettings({ ...settings, nativeLanguage: next });
          }}
        />
      </div>
    </header>
  );
}

function LanguageSelect<T extends Locale>({
  id,
  label,
  value,
  options,
  locale,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  locale: Locale;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option === event.target.value);
          if (next !== undefined) onChange(next);
        }}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {languageName(locale, option)}
          </option>
        ))}
      </select>
    </div>
  );
}
