import { useSyncExternalStore } from "react";

import type { ReaderSettings } from "#/preferences/settings";
import { readSettings, SETTINGS_STORAGE_KEY, writeSettings } from "#/preferences/settings";

const settingsEventName = "2books-settings";

// Stable reference: a new object from getServerSnapshot loops useSyncExternalStore.
const serverSettings: ReaderSettings = Object.freeze({
  interfaceLocale: "uk",
  nativeLanguage: "uk",
});

let cachedKey: string | null = null;
let cachedSettings: ReaderSettings = serverSettings;

function languageListKey(languages: readonly string[]): string {
  return Array.from(languages).join("\u0000");
}

function getSnapshot(): ReaderSettings {
  // Hydration uses getServerSnapshot. Never read the browser from the server.
  if (typeof window === "undefined") return serverSettings;

  let storage: Storage | null = null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    storage = localStorage;
  } catch {
    storage = null;
    raw = null;
  }

  let languages: readonly string[] = [];
  try {
    languages = navigator.languages ?? [];
  } catch {
    languages = [];
  }

  let key: string;
  try {
    key = `${raw ?? ""}\u0000${languageListKey(languages)}`;
  } catch {
    return cachedSettings;
  }
  // Same stored string and language list must keep the same object, or React loops.
  if (key === cachedKey) return cachedSettings;

  let next = serverSettings;
  try {
    next = readSettings(storage, languages);
    if (
      next.interfaceLocale === serverSettings.interfaceLocale &&
      next.nativeLanguage === serverSettings.nativeLanguage
    ) {
      next = serverSettings;
    }
  } catch {
    next = serverSettings;
  }
  cachedKey = key;
  cachedSettings = next;
  return cachedSettings;
}

function getServerSnapshot(): ReaderSettings {
  return serverSettings;
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => {
    onStoreChange();
  };
  window.addEventListener("storage", onChange);
  window.addEventListener(settingsEventName, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(settingsEventName, onChange);
  };
}

export function updateSettings(next: ReaderSettings): void {
  try {
    writeSettings(localStorage, next);
  } catch {
    // localStorage can throw. Rendering must continue.
  }
  try {
    window.dispatchEvent(new Event(settingsEventName));
  } catch {
    // Ignore a missing window. The render itself must not crash.
  }
}

export function useReaderSettings(): {
  settings: ReaderSettings;
  updateSettings: (next: ReaderSettings) => void;
} {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { settings, updateSettings };
}
