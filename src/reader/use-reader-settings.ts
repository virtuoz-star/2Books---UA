import { getRouteApi } from "@tanstack/react-router";
import { useRef, useSyncExternalStore } from "react";

import type { ReaderSettings } from "#/preferences/settings";
import {
  fallbackReaderSettings,
  readSettings,
  SETTINGS_STORAGE_KEY,
  settingsCookieAssignment,
  settingsPayload,
  writeSettings,
} from "#/preferences/settings";

const rootRoute = getRouteApi("__root__");
const settingsEventName = "2books-settings";

let memorySettings: ReaderSettings | null = null;
let cachedKey: string | null = null;
let cachedSettings: ReaderSettings = fallbackReaderSettings;

function sameSettings(left: ReaderSettings, right: ReaderSettings): boolean {
  return (
    left.interfaceLocale === right.interfaceLocale &&
    left.nativeLanguage === right.nativeLanguage &&
    left.readingFont === right.readingFont &&
    left.readingSize === right.readingSize &&
    left.readingPaper === right.readingPaper &&
    left.translationMode === right.translationMode &&
    left.hintSeen === right.hintSeen
  );
}

function languageListKey(languages: readonly string[]): string {
  return Array.from(languages).join("\u0000");
}

function applyDocumentSettings(settings: ReaderSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = settings.interfaceLocale;
  root.dataset.font = settings.readingFont;
  root.dataset.size = settings.readingSize;
  root.dataset.paper = settings.readingPaper;
}

function writeSettingsCookie(settings: ReaderSettings): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = settingsCookieAssignment(settings);
  } catch {
    // A blocked cookie must not undo the in-memory choice.
  }
}

export function currentReaderSettings(): ReaderSettings {
  if (typeof window === "undefined") return fallbackReaderSettings;
  return getSnapshot();
}

function getSnapshot(): ReaderSettings {
  if (memorySettings !== null) return memorySettings;
  if (typeof window === "undefined") return fallbackReaderSettings;

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
  if (key === cachedKey) return cachedSettings;

  let next = fallbackReaderSettings;
  try {
    next = readSettings(storage, languages);
    if (sameSettings(next, fallbackReaderSettings)) next = fallbackReaderSettings;
  } catch {
    next = fallbackReaderSettings;
  }
  cachedKey = key;
  cachedSettings = next;
  return cachedSettings;
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
  const payload = JSON.stringify(settingsPayload(next));
  let persisted = false;
  try {
    writeSettings(localStorage, next);
    persisted = localStorage.getItem(SETTINGS_STORAGE_KEY) === payload;
  } catch {
    persisted = false;
  }
  writeSettingsCookie(next);
  memorySettings = persisted ? null : next;
  if (persisted) cachedKey = null;
  applyDocumentSettings(memorySettings ?? next);
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
  const { settings: serverSettings } = rootRoute.useRouteContext();
  const frozen = useRef(serverSettings);
  if (!sameSettings(frozen.current, serverSettings)) frozen.current = serverSettings;
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => frozen.current);
  return { settings, updateSettings };
}
