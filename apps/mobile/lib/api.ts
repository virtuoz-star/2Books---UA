import type { BookDetail, BookSummary, BookTitle, Chapter, Sentence } from "@/lib/types";

const DEFAULT_API_URL = "http://localhost:3001";

export const JSON_TIMEOUT_MS = 15_000;
export const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;

function releaseBuild(): boolean {
  if (typeof __DEV__ === "boolean") return !__DEV__;
  return process.env.NODE_ENV === "production";
}

export function resolveApiBase(input: { release: boolean; configured: string | undefined }): string {
  const trimmed =
    typeof input.configured === "string" ? input.configured.trim().replace(/\/+$/, "") : "";
  if (input.release) {
    if (!trimmed.startsWith("https://")) {
      throw new Error("EXPO_PUBLIC_API_URL must be an https URL in release builds");
    }
    return trimmed;
  }
  if (trimmed.length > 0) return trimmed;
  return DEFAULT_API_URL;
}

export function apiBase(): string {
  return resolveApiBase({
    release: releaseBuild(),
    configured: process.env.EXPO_PUBLIC_API_URL,
  });
}

export function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (signal === undefined) return timeout;
  return AbortSignal.any([signal, timeout]);
}

export function startIdleTimeout(timeoutMs: number): {
  signal: AbortSignal;
  activity: () => void;
  stop: () => void;
} {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer !== null) clearTimeout(timer);
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      timer = null;
      controller.abort();
    }, timeoutMs);
  };
  arm();
  return {
    signal: controller.signal,
    activity: arm,
    stop: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

export type SessionPhase = "unknown" | "in" | "out";

export type SessionAccount = { id: string; email: string };

export type SessionView = {
  phase: SessionPhase;
  account: SessionAccount | null;
  checkFailed: boolean;
};

export function accountFromUser(user: unknown): SessionAccount | null {
  if (typeof user !== "object" || user === null) return null;
  const id = (user as { id?: unknown }).id;
  const email = (user as { email?: unknown }).email;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof email !== "string" || email.length === 0) return null;
  return { id, email };
}

export function sessionErrorStatus(error: unknown): number | "network" | null {
  if (error == null) return null;
  if (typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && Number.isFinite(status)) return status;
  }
  return "network";
}

/** Keep the last account unless the server definitely says there is no session. */
export function applySessionResult(
  current: SessionView,
  input: { user: unknown; errorStatus: number | "network" | null; pending: boolean },
): SessionView {
  if (input.errorStatus === 401) return { phase: "out", account: null, checkFailed: false };
  const account = accountFromUser(input.user);
  if (input.errorStatus !== null) {
    if (account) return { phase: "in", account, checkFailed: true };
    if (current.phase === "in" && current.account) {
      return { phase: "in", account: current.account, checkFailed: true };
    }
    if (current.phase === "out") return { phase: "out", account: null, checkFailed: true };
    return { phase: "unknown", account: null, checkFailed: true };
  }
  if (account) return { phase: "in", account, checkFailed: false };
  if (input.pending) return current;
  return { phase: "out", account: null, checkFailed: false };
}

export function syncFailureAfterUserChange(userChanged: boolean, failed: boolean): boolean {
  if (userChanged) return false;
  return failed;
}

export function isDegradedCatalog(input: {
  status: number;
  degradedHeader: string | null;
  body: unknown;
}): boolean {
  if (input.status !== 200) return true;
  const header = input.degradedHeader?.trim().toLowerCase() ?? "";
  if (header === "1" || header === "true") return true;
  if (isRecord(input.body)) {
    if (input.body.degraded === true) return true;
    if ("error" in input.body) return true;
    return true;
  }
  return !Array.isArray(input.body);
}

/** A degraded payload must not replace the last good list or become a fresh cache entry. */
export function nextCachedList<T>(
  previous: T[] | null,
  incoming: { degraded: boolean; list: T[] | null },
): T[] | null {
  if (incoming.degraded || incoming.list === null) return previous;
  return incoming.list;
}

let catalogMemory: BookSummary[] | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTitle(value: unknown): BookTitle {
  if (!isRecord(value)) throw new Error("Invalid book title");
  const { uk, ru, en } = value;
  if (typeof uk !== "string" || typeof ru !== "string" || typeof en !== "string") {
    throw new Error("Invalid book title");
  }
  return { uk, ru, en };
}

function parseText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  throw new Error("Invalid sentence text");
}

function parseParagraph(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function parseSentence(value: unknown): Sentence {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid sentence");
  }
  const sentence: Sentence = {
    id: value.id,
    en: parseText(value.en),
    uk: parseText(value.uk),
    ru: parseText(value.ru),
  };
  const paragraph = parseParagraph(value.paragraph);
  if (paragraph !== undefined) sentence.paragraph = paragraph;
  return sentence;
}

function parseChapterTitle(value: unknown): BookTitle {
  if (typeof value === "string") return { uk: value, ru: value, en: value };
  if (isRecord(value)) {
    const { uk, ru, en } = value;
    if (typeof uk === "string" && typeof ru === "string" && typeof en === "string") {
      return { uk, ru, en };
    }
  }
  throw new Error("Invalid chapter");
}

function parseChapter(value: unknown): Chapter {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid chapter");
  }
  if (!Array.isArray(value.sentences)) throw new Error("Invalid chapter");
  return {
    id: value.id,
    title: parseChapterTitle(value.title),
    sentences: value.sentences.map(parseSentence),
  };
}

function parseSummary(value: unknown): BookSummary {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid book");
  }
  if (typeof value.author !== "string") throw new Error("Invalid book");
  if (typeof value.chapterCount !== "number" || !Number.isFinite(value.chapterCount)) {
    throw new Error("Invalid book");
  }
  return {
    id: value.id,
    author: value.author,
    title: parseTitle(value.title),
    chapterCount: value.chapterCount,
  };
}

function parseBook(value: unknown): BookDetail {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid book");
  }
  if (typeof value.author !== "string" || !Array.isArray(value.chapters)) {
    throw new Error("Invalid book");
  }
  return {
    id: value.id,
    author: value.author,
    title: parseTitle(value.title),
    chapters: value.chapters.map(parseChapter),
  };
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<unknown>;
}

async function readCatalogBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchBooks(signal?: AbortSignal): Promise<BookSummary[]> {
  const response = await fetch(`${apiBase()}/api/books`, {
    signal: withTimeout(signal, JSON_TIMEOUT_MS),
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const body = await readCatalogBody(response);
  const degraded = isDegradedCatalog({
    status: response.status,
    degradedHeader: response.headers.get("x-catalog-degraded"),
    body,
  });
  let list: BookSummary[] | null = null;
  if (!degraded && Array.isArray(body)) {
    try {
      list = body.map(parseSummary);
    } catch {
      list = null;
    }
  }
  const next = nextCachedList(catalogMemory, { degraded: degraded || list === null, list });
  if (!degraded && list !== null) catalogMemory = list;
  if (next === null) throw new Error("Catalog unavailable");
  return next;
}

export async function fetchBook(id: string, signal?: AbortSignal): Promise<BookDetail> {
  const response = await fetch(`${apiBase()}/api/books/${encodeURIComponent(id)}`, {
    signal: withTimeout(signal, JSON_TIMEOUT_MS),
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  return parseBook(await readJson(response));
}
