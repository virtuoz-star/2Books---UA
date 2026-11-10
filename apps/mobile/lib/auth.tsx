import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import {
  apiBase,
  applySessionResult,
  JSON_TIMEOUT_MS,
  sessionErrorStatus,
  withTimeout,
  type SessionView,
} from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useSettings } from "@/lib/settings";
import {
  scheduleWordSync,
  subscribeWordSync,
  syncOnForeground,
  wordSyncFailed,
} from "@/lib/word-sync";

type AuthValue = {
  email: string | null;
  status: SessionView["phase"];
  sessionCheckFailed: boolean;
  googleReady: boolean;
  signInFailed: boolean;
  syncFailed: boolean;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const unknownSession: SessionView = { phase: "unknown", account: null, checkFailed: false };

async function readSession(): Promise<{
  user: unknown;
  errorStatus: number | "network" | null;
  pending: boolean;
}> {
  try {
    const result = await authClient.getSession({
      fetchOptions: { signal: withTimeout(undefined, JSON_TIMEOUT_MS) },
    });
    return {
      user: result.data?.user,
      errorStatus: sessionErrorStatus(result.error),
      pending: false,
    };
  } catch (error) {
    const status = sessionErrorStatus(error);
    return { user: null, errorStatus: status ?? "network", pending: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const cached = authClient.useSession();
  const [view, setView] = useState<SessionView>(unknownSession);
  const [googleReady, setGoogleReady] = useState(true);
  const [signInFailed, setSignInFailed] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  const apply = useCallback(
    (input: { user: unknown; errorStatus: number | "network" | null; pending: boolean }) => {
      setView((current) => {
        const next = applySessionResult(current, input);
        if (
          next.phase === current.phase &&
          next.checkFailed === current.checkFailed &&
          next.account?.id === current.account?.id &&
          next.account?.email === current.account?.email
        ) {
          return current;
        }
        return next;
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    apply(await readSession());
  }, [apply]);

  useEffect(() => {
    apply({
      user: cached.data?.user,
      errorStatus: sessionErrorStatus(cached.error),
      pending: cached.isPending,
    });
  }, [apply, cached.data, cached.error, cached.isPending]);

  useEffect(() => {
    if (view.phase === "unknown") return;
    scheduleWordSync(view.phase === "in" ? (view.account?.id ?? null) : null);
  }, [view.account?.id, view.phase]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      void refresh();
      syncOnForeground();
    });
    return () => {
      subscription.remove();
    };
  }, [refresh]);

  useEffect(() => {
    void refresh();
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${apiBase()}/api/session/ready`, {
          signal: withTimeout(undefined, JSON_TIMEOUT_MS),
          credentials: "omit",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
        const body: unknown = await response.json();
        if (cancelled) return;
        if (
          typeof body === "object" &&
          body !== null &&
          "google" in body &&
          (body as { google?: unknown }).google === false
        ) {
          setGoogleReady(false);
        }
      } catch {
        // A failed ready check leaves the sign-in button visible.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    setSyncFailed(wordSyncFailed());
    return subscribeWordSync(() => {
      setSyncFailed(wordSyncFailed());
    });
  }, []);

  const signIn = useCallback(async () => {
    const nativeLanguage = settings.nativeLanguage;
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
        additionalData: { nativeLanguage },
        fetchOptions: { signal: withTimeout(undefined, JSON_TIMEOUT_MS) },
      });
      if (result.error) {
        setSignInFailed(true);
        return;
      }
      setSignInFailed(false);
      apply(await readSession());
    } catch {
      setSignInFailed(true);
    }
  }, [apply, settings.nativeLanguage]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut({
        fetchOptions: { signal: withTimeout(undefined, JSON_TIMEOUT_MS) },
      });
    } catch {
      // The local session view still clears. The word file stays.
    }
    setView({ phase: "out", account: null, checkFailed: false });
    setSignInFailed(false);
    scheduleWordSync(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      email: view.account?.email ?? null,
      status: view.phase,
      sessionCheckFailed: view.checkFailed,
      googleReady,
      signInFailed,
      syncFailed,
      refresh,
      signIn,
      signOut,
    }),
    [
      googleReady,
      refresh,
      signIn,
      signInFailed,
      signOut,
      syncFailed,
      view.account?.email,
      view.checkFailed,
      view.phase,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("AuthProvider is missing");
  }
  return value;
}
