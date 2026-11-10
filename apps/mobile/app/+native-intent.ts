import { Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { enqueueIncoming } from "@/lib/incoming-file";
import { sharedUriAllowed, shouldSkipInitialIntent } from "@/lib/local-plan";

const handledKey = "2books.handledIntent";

type HandledIntent = { url: string; at: number };

let memory: HandledIntent | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function acceptIncomingUri(uri: string): boolean {
  let documentHref: string | null = null;
  let cacheHref: string | null = null;
  try {
    documentHref = Paths.document.uri;
  } catch {
    documentHref = null;
  }
  try {
    cacheHref = Paths.cache.uri;
  } catch {
    cacheHref = null;
  }
  return sharedUriAllowed(uri, Platform.OS, { documentHref, cacheHref });
}

function readHandled(): HandledIntent | null {
  if (memory) return memory;
  try {
    const raw = SecureStore.getItem(handledKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.url !== "string" || typeof parsed.at !== "number") {
      return null;
    }
    memory = { url: parsed.url, at: parsed.at };
    return memory;
  } catch {
    return memory;
  }
}

function rememberHandled(url: string): void {
  const next = { url, at: Date.now() };
  memory = next;
  try {
    SecureStore.setItem(handledKey, JSON.stringify(next));
  } catch {
    // The in-memory URL still skips a relaunch inside this process.
  }
}

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const url = new URL(path);
    if (url.hostname === "expo-sharing") return "/";
    if (url.protocol === "file:" || url.protocol === "content:") {
      if (!acceptIncomingUri(path)) return "/";
      if (shouldSkipInitialIntent(initial, path, readHandled())) return "/";
      rememberHandled(path);
      enqueueIncoming({ uri: path, name: null });
      return "/";
    }
    if (url.protocol === "exp:" || url.protocol === "twobooks:") return "/";
  } catch {
    return path;
  }
  return path;
}
