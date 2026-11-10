import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { parseStoredSettings, serializeSettings } from "@/lib/reading-settings";
import type { ReaderSettings } from "@/lib/types";
import {
  defaultInterfaceLocale,
  defaultNativeLanguage,
} from "../../../src/i18n/locale";

const STORAGE_KEY = "2books.settings";

type SettingsContextValue = {
  settings: ReaderSettings;
  ready: boolean;
  updateSettings: (next: ReaderSettings) => void;
  patchSettings: (patch: Partial<ReaderSettings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function deviceLanguages(): string[] {
  try {
    const code = Localization.getLocales()[0]?.languageCode;
    return typeof code === "string" && code.length > 0 ? [code] : [];
  } catch {
    return [];
  }
}

export function deviceSettings(languages: readonly string[]): ReaderSettings {
  return {
    interfaceLocale: defaultInterfaceLocale(languages),
    nativeLanguage: defaultNativeLanguage(languages),
    readingFont: "literary",
    readingSize: "regular",
    readingPaper: "auto",
    hintSeen: false,
    wordHintSeen: false,
  };
}

function readInitialSettings(): ReaderSettings {
  const fallback = deviceSettings(deviceLanguages());
  if (Platform.OS === "web") return fallback;
  try {
    const raw = SecureStore.getItem(STORAGE_KEY);
    if (raw === null || raw.length === 0) return fallback;
    return parseStoredSettings(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

async function persistSettings(settings: ReaderSettings): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, serializeSettings(settings));
  } catch {
    // SecureStore is best-effort. The in-memory session settings still apply.
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(readInitialSettings);
  const ready = true;

  const updateSettings = useCallback((next: ReaderSettings) => {
    setSettings(next);
    void persistSettings(next);
  }, []);

  const patchSettings = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void persistSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      ready,
      updateSettings,
      patchSettings,
    }),
    [patchSettings, settings, updateSettings],
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
