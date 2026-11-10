import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import { withTimeout } from "@/lib/api";
import {
  googleTranslateEndpoint,
  readTranslations,
} from "../../../src/dictionary/google-translate";

const storageKey = "2books.googleTranslateKey";

export async function readPhoneGoogleKey(): Promise<string> {
  try {
    return ((await SecureStore.getItemAsync(storageKey)) ?? "").trim();
  } catch {
    return "";
  }
}

export async function writePhoneGoogleKey(trimmed: string): Promise<void> {
  if (trimmed.length === 0) {
    await SecureStore.deleteItemAsync(storageKey);
    return;
  }
  await SecureStore.setItemAsync(storageKey, trimmed);
}

export function publicTranslateUrl(normalizedWord: string, target: "uk" | "ru"): string {
  return `https://translate.google.com/?sl=en&tl=${target}&text=${encodeURIComponent(normalizedWord)}`;
}

export async function openPublicTranslate(
  normalizedWord: string,
  target: "uk" | "ru",
): Promise<boolean> {
  try {
    await WebBrowser.openBrowserAsync(publicTranslateUrl(normalizedWord, target));
    return true;
  } catch {
    return false;
  }
}

export async function postPhoneGoogleTranslate(input: {
  key: string;
  q: readonly string[];
  target: "uk" | "ru";
  signal: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; rows: ({ text: string } | { text: null })[] }
  | { ok: false; status: number | "network" | "aborted" }
> {
  const signal = withTimeout(input.signal, input.timeoutMs);
  try {
    const response = await fetch(googleTranslateEndpoint(input.key), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        q: input.q,
        source: "en",
        target: input.target,
        format: "text",
      }),
      signal,
    });
    if (!response.ok) {
      console.error("google-translate", response.status);
      return { ok: false, status: response.status };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      console.error("google-translate", response.status);
      return { ok: false, status: response.status };
    }
    const rows = readTranslations(body, input.q.length);
    if (rows === null) {
      console.error("google-translate", response.status);
      return { ok: false, status: response.status };
    }
    return { ok: true, rows };
  } catch {
    if (input.signal.aborted) return { ok: false, status: "aborted" };
    console.error("google-translate", "network");
    return { ok: false, status: "network" };
  }
}
