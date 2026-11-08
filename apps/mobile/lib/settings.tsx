import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { isLocale, isNativeLanguage, type ReaderSettings } from "@/lib/types";

const STORAGE_KEY = "2books.settings";

const defaultSettings: ReaderSettings = {
  interfaceLocale: "uk",
  nativeLanguage: "uk",
};

type SettingsContextValue = {
  settings: ReaderSettings;
  updateSettings: (next: ReaderSettings) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function parseStored(raw: string): ReaderSettings | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (!isLocale(record.interfaceLocale) || !isNativeLanguage(record.nativeLanguage)) return null;
    return {
      interfaceLocale: record.interfaceLocale,
      nativeLanguage: record.nativeLanguage,
    };
  } catch {
    return null;
  }
}

async function loadSettings(): Promise<ReaderSettings | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw === null || raw.length === 0) return null;
    return parseStored(raw);
  } catch {
    return null;
  }
}

async function persistSettings(settings: ReaderSettings): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({
        interfaceLocale: settings.interfaceLocale,
        nativeLanguage: settings.nativeLanguage,
      }),
    );
  } catch {
    // SecureStore is best-effort. The in-memory session settings still apply.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const edited = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((stored) => {
      if (cancelled || edited.current || stored === null) return;
      setSettings(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback((next: ReaderSettings) => {
    edited.current = true;
    setSettings(next);
    void persistSettings(next);
  }, []);

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
    }),
    [settings, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (value === null) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return value;
}
