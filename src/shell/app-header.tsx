import { getRouteApi, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { resetSessionCache, signOut, updateNativeLanguage, type CurrentUser } from "#/auth/session";
import { Button } from "#/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { clearLocalStudyData, scheduleWordSync, settleWordSync } from "#/dictionary/word-sync";
import { message } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import { currentReaderSettings, useReaderSettings } from "#/reader/use-reader-settings";
import { Logo } from "#/shell/logo";
import { ReadingLanguageContext } from "#/shell/reading-language";
import { SettingsMenu } from "#/shell/settings-menu";

const rootRoute = getRouteApi("__root__");

export { useNativeLanguage } from "#/shell/reading-language";

function readerPath(pathname: string): boolean {
  return /^\/books\/[^/]+\/c\d+$/.test(pathname);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = rootRoute.useRouteContext();
  const { settings } = useReaderSettings();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const reader = readerPath(pathname);
  const admin = pathname === "/admin" || pathname.startsWith("/admin/");
  const mainWidth = admin || pathname === "/" ? "max-w-6xl" : reader ? "max-w-6xl" : "max-w-2xl";
  const locale = settings.interfaceLocale;

  useEffect(() => {
    scheduleWordSync(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    const live = currentReaderSettings();
    root.lang = live.interfaceLocale;
    root.dataset.font = live.readingFont;
    root.dataset.size = live.readingSize;
    root.dataset.paper = live.readingPaper;
  }, [settings]);

  return (
    <ReadingLanguageProvider user={user}>
      <a className="skip-link" href="#main">
        {message(locale, "skipToText")}
      </a>
      <PendingBar label={message(locale, "loading")} />
      <div className="flex min-h-svh flex-col">
        {reader ? null : (
          <div className="sticky top-0 z-30 mx-auto w-full max-w-6xl bg-background/95 px-4 sm:px-8">
            <AppHeader user={user} />
          </div>
        )}
        <div
          className={`mx-auto flex w-full flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10 ${mainWidth} ${reader ? "" : "pb-24 sm:pb-10"}`}
        >
          <main id="main" tabIndex={-1} lang={locale} className="flex flex-1 flex-col outline-none">
            {children}
          </main>
        </div>
        {reader ? null : <BottomNav user={user} pathname={pathname} locale={locale} />}
      </div>
    </ReadingLanguageProvider>
  );
}

function PendingBar({ label }: { label: string }) {
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(id);
  }, [pending]);
  if (!visible) return null;
  return <div className="pending-bar" role="progressbar" aria-label={label} />;
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
        .then(() => {
          resetSessionCache();
          return router.invalidate();
        })
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border">
      <Logo locale={locale} />
      <nav className="hidden items-center gap-4 text-sm sm:flex" aria-label={message(locale, "navMain")}>
        <NavLinks user={user} pathname={pathname} locale={locale} />
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <SettingsMenu />
        <AccountMenu user={user} locale={locale} pathname={pathname} />
      </div>
    </header>
  );
}

function NavLinks({
  user,
  pathname,
  locale,
}: {
  user: CurrentUser | null;
  pathname: string;
  locale: Locale;
}) {
  return (
    <>
      <Link to="/" className={navClass(pathname === "/")}>
        {message(locale, "navLibrary")}
      </Link>
      <Link to="/words" className={navClass(pathname === "/words")}>
        {message(locale, "navWords")}
      </Link>
      <Link to="/upload" className={navClass(pathname === "/upload")}>
        {message(locale, "navAdd")}
      </Link>
      {user?.role === "admin" ? (
        <Link
          to="/admin"
          search={{ q: "" }}
          className={navClass(pathname === "/admin" || pathname.startsWith("/admin/"))}
        >
          {message(locale, "adminLink")}
        </Link>
      ) : null}
    </>
  );
}

function AccountMenu({
  user,
  locale,
  pathname,
}: {
  user: CurrentUser | null;
  locale: Locale;
  pathname: string;
}) {
  const router = useRouter();
  if (user === null) {
    return (
      <Link
        to="/sign-in"
        search={{ redirect: pathname === "/sign-in" ? "/" : pathname }}
        className="nav-link px-2 text-sm font-medium text-foreground no-underline"
      >
        {message(locale, "signIn")}
      </Link>
    );
  }
  const label = user.name.trim() || user.email;
  const onSignOut = () => {
    if (typeof window === "undefined") return;
    if (!window.confirm(message(locale, "signOutConfirm"))) return;
    void (async () => {
      try {
        await settleWordSync();
        await signOut();
      } catch {
        return;
      }
      clearLocalStudyData();
      resetSessionCache();
      try {
        await router.invalidate();
      } catch {
        // The next load reads the session again.
      }
    })();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="icon-btn btn btn-quiet text-sm font-medium" aria-label={message(locale, "navAccount")}>
          {label.slice(0, 1).toUpperCase()}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-3">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <Button type="button" variant="secondary" onClick={onSignOut}>
          {message(locale, "signOut")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function BottomNav({
  user,
  pathname,
  locale,
}: {
  user: CurrentUser | null;
  pathname: string;
  locale: Locale;
}) {
  return (
    <nav className="tab-bar sm:hidden" aria-label={message(locale, "navMain")}>
      <Link to="/" className={tabClass(pathname === "/")}>
        {message(locale, "navLibrary")}
      </Link>
      <Link to="/words" className={tabClass(pathname === "/words")}>
        {message(locale, "navWords")}
      </Link>
      <Link to="/upload" className={tabClass(pathname === "/upload")}>
        {message(locale, "navAdd")}
      </Link>
      {user?.role === "admin" ? (
        <Link
          to="/admin"
          search={{ q: "" }}
          className={tabClass(pathname === "/admin" || pathname.startsWith("/admin/"))}
        >
          {message(locale, "adminLink")}
        </Link>
      ) : null}
    </nav>
  );
}

function navClass(active: boolean): string {
  return active
    ? "nav-link font-medium text-foreground underline decoration-2 decoration-primary"
    : "nav-link font-medium text-muted-foreground no-underline hover:text-foreground hover:underline hover:decoration-primary";
}

function tabClass(active: boolean): string {
  return active
    ? "flex flex-1 items-center justify-center px-2 text-xs font-medium text-foreground"
    : "flex flex-1 items-center justify-center px-2 text-xs font-medium text-muted-foreground";
}
