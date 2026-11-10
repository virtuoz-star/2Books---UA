export type LocalProgress = {
  bookId: string;
  chapterId: string;
  sentenceId: string | null;
  updatedAt: number;
};

export const PROGRESS_STORAGE_KEY = "2books.progress";

export function rememberProgress(
  entries: readonly LocalProgress[],
  next: LocalProgress,
): LocalProgress[] {
  const rest = entries.filter((entry) => entry.bookId !== next.bookId);
  return [next, ...rest].slice(0, 200);
}

/** Closing the study panel keeps the sentence that was open. */
export function progressAfterClose(entry: LocalProgress): LocalProgress {
  return entry;
}

export function preferProgress(
  local: LocalProgress | null,
  remote: LocalProgress | null,
): LocalProgress | null {
  if (local === null) return remote;
  if (remote === null) return local;
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

/**
 * A newly opened part is stored without a sentence.
 * The same part keeps its sentence, so the caller writes nothing.
 */
export function progressForOpenedChapter(
  stored: LocalProgress | null,
  bookId: string,
  chapterId: string,
  updatedAt: number,
): LocalProgress | null {
  if (stored !== null && stored.bookId === bookId && stored.chapterId === chapterId) return null;
  return { bookId, chapterId, sentenceId: null, updatedAt };
}

function isProgress(value: unknown): value is LocalProgress {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<LocalProgress>;
  if (typeof row.bookId !== "string" || row.bookId.length < 1) return false;
  if (typeof row.chapterId !== "string" || row.chapterId.length < 1) return false;
  if (row.sentenceId !== null && typeof row.sentenceId !== "string") return false;
  return typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt);
}

export function readProgressList(
  storage: { getItem(key: string): string | null } | null,
): LocalProgress[] {
  if (storage === null) return [];
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (raw === null || raw === "") return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProgress);
  } catch {
    return [];
  }
}

export function writeProgressList(
  storage: { setItem(key: string, value: string): void } | null,
  entries: readonly LocalProgress[],
): boolean {
  if (storage === null) return false;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function loadBrowserProgress(bookId: string): LocalProgress | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return readProgressList(localStorage).find((entry) => entry.bookId === bookId) ?? null;
  } catch {
    return null;
  }
}

export function mergeProgress(
  local: readonly LocalProgress[],
  remote: readonly LocalProgress[],
): LocalProgress[] {
  const byBook = new Map<string, LocalProgress>();
  for (const row of remote) byBook.set(row.bookId, row);
  for (const row of local) {
    const chosen = preferProgress(row, byBook.get(row.bookId) ?? null);
    if (chosen) byBook.set(row.bookId, chosen);
  }
  return [...byBook.values()].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveBrowserProgress(entry: LocalProgress): void {
  if (typeof localStorage === "undefined") return;
  try {
    const next = rememberProgress(readProgressList(localStorage), entry);
    writeProgressList(localStorage, next);
  } catch {
    // Reading progress is best-effort when storage is blocked.
  }
}
