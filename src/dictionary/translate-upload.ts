import { loadUploadSentences, saveUploadTranslations } from "#/library/api";
import { packTranslateBatches } from "#/dictionary/google-translate";

import { postGoogleTranslate } from "./google-request";

const maxSavedLength = 8_000;

export type OwnedUploadNotice =
  | { kind: "need-key" }
  | { kind: "none" }
  | { kind: "anonymous" }
  | { kind: "failed" }
  | { kind: "rejected" }
  | { kind: "quota" }
  | { kind: "saved"; skipped: number }
  | { kind: "pending"; skipped: number };

export function noticeFromUpload(result: UploadTranslationResult): OwnedUploadNotice | null {
  if (result.ok) {
    return result.alignment === "ready"
      ? { kind: "saved", skipped: result.skipped }
      : { kind: "pending", skipped: result.skipped };
  }
  if (result.error === "aborted") return null;
  if (result.error === "none") return { kind: "none" };
  if (result.error === "anonymous") return { kind: "anonymous" };
  if (result.error === "rejected") return { kind: "rejected" };
  if (result.error === "quota") return { kind: "quota" };
  return { kind: "failed" };
}

export type UploadTranslationResult =
  | {
      ok: true;
      alignment: "pending" | "ready";
      skipped: number;
      pairs: { id: string; uk: string; ru: string }[];
    }
  | { ok: false; error: "none" | "anonymous" | "failed" | "aborted" | "rejected" | "quota" };

type Sentence = { id: string; en: string; uk: string; ru: string };

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type TargetFailure = "rejected" | "quota" | "failed" | "aborted";

type TargetResult =
  | { ok: true; rows: ({ text: string } | { text: null })[] }
  | { ok: false; reason: TargetFailure };

function stopped(status: number | "network" | "aborted"): TargetFailure | null {
  if (status === "aborted") return "aborted";
  if (status === 401 || status === 403) return "rejected";
  if (status === 429) return "quota";
  return null;
}

async function postTarget(
  key: string,
  q: readonly string[],
  target: "uk" | "ru",
  signal: AbortSignal,
): Promise<TargetResult> {
  const once = () => postGoogleTranslate({ key, q, target, signal, timeoutMs: 30_000 });
  try {
    const first = await once();
    if (first.ok) return { ok: true, rows: first.rows };
    const firstStop = stopped(first.status);
    if (firstStop === "aborted" || firstStop === "rejected") return { ok: false, reason: firstStop };
    if (firstStop === "quota") {
      await delay(2_000, signal);
      const second = await once();
      if (second.ok) return { ok: true, rows: second.rows };
      const secondStop = stopped(second.status);
      if (secondStop !== null) return { ok: false, reason: secondStop };
      return { ok: false, reason: "failed" };
    }
    if (
      first.status === "network" ||
      first.status === 500 ||
      first.status === 502 ||
      first.status === 503 ||
      first.status === 504
    ) {
      const second = await once();
      if (second.ok) return { ok: true, rows: second.rows };
      const secondStop = stopped(second.status);
      if (secondStop !== null) return { ok: false, reason: secondStop };
      return { ok: false, reason: "failed" };
    }
    return { ok: false, reason: "failed" };
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return { ok: false, reason: "aborted" };
    }
    return { ok: false, reason: "failed" };
  }
}

function savable(text: string | null): string | null {
  if (text === null) return null;
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > maxSavedLength) return null;
  return trimmed;
}

export async function translateOwnedUpload(input: {
  bookId: string;
  again: boolean;
  key: string;
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
}): Promise<UploadTranslationResult> {
  if (input.signal.aborted) return { ok: false, error: "aborted" };
  let loaded: Awaited<ReturnType<typeof loadUploadSentences>>;
  try {
    loaded = await loadUploadSentences({ data: { bookId: input.bookId } });
  } catch {
    return { ok: false, error: "failed" };
  }
  if (input.signal.aborted) return { ok: false, error: "aborted" };
  if (loaded === null) return { ok: false, error: "failed" };
  const selected: Sentence[] = input.again
    ? loaded.sentences
    : loaded.sentences.filter((sentence) => sentence.uk.trim() === "" || sentence.ru.trim() === "");
  const total = selected.length;
  const texts = selected.map((sentence) => sentence.en);
  const packed = packTranslateBatches(texts);
  const failed = new Set<number>(packed.unpackable);
  const uk = new Map<number, string>();
  const ru = new Map<number, string>();
  let done = packed.unpackable.length;
  if (total > 0) input.onProgress(done, total);
  let alignment: "pending" | "ready" = "pending";
  const savedPairs: { id: string; uk: string; ru: string }[] = [];

  for (const batch of packed.batches) {
    if (input.signal.aborted) return { ok: false, error: "aborted" };
    const q = batch.indexes.map((index) => texts[index] ?? "");
    const ukResult = await postTarget(input.key, q, "uk", input.signal);
    if (!ukResult.ok && ukResult.reason !== "failed") return { ok: false, error: ukResult.reason };
    const ruResult = ukResult.ok ? await postTarget(input.key, q, "ru", input.signal) : ukResult;
    if (!ruResult.ok && ruResult.reason !== "failed") return { ok: false, error: ruResult.reason };
    const batchPairs: { id: string; uk: string; ru: string }[] = [];
    for (let offset = 0; offset < batch.indexes.length; offset += 1) {
      const index = batch.indexes[offset] ?? 0;
      const sentence = selected[index];
      if (!ukResult.ok || !ruResult.ok || sentence === undefined) {
        failed.add(index);
      } else {
        const savedUk = savable(ukResult.rows[offset]?.text ?? null);
        const savedRu = savable(ruResult.rows[offset]?.text ?? null);
        if (savedUk === null || savedRu === null) failed.add(index);
        else {
          uk.set(index, savedUk);
          ru.set(index, savedRu);
          batchPairs.push({ id: sentence.id, uk: savedUk, ru: savedRu });
        }
      }
      done += 1;
      if (total > 0) input.onProgress(done, total);
    }
    if (batchPairs.length > 0) {
      const saved = await saveBatch(input.bookId, input.again, batchPairs, input.signal);
      if (!saved.ok) return saved;
      alignment = saved.alignment;
      savedPairs.push(...batchPairs);
    }
  }

  if (input.signal.aborted) return { ok: false, error: "aborted" };
  if (savedPairs.length === 0) return { ok: false, error: "none" };
  return { ok: true, alignment, skipped: failed.size, pairs: savedPairs };
}

async function saveBatch(
  bookId: string,
  again: boolean,
  pairs: { id: string; uk: string; ru: string }[],
  signal: AbortSignal,
): Promise<
  | { ok: true; alignment: "pending" | "ready" }
  | { ok: false; error: "anonymous" | "failed" | "aborted" }
> {
  const saveOnce = () => saveUploadTranslations({ data: { bookId, again, sentences: pairs } });
  try {
    let saved = await saveOnce();
    if (!saved.ok && saved.error === "unavailable") {
      if (signal.aborted) return { ok: false, error: "aborted" };
      await loadUploadSentences({ data: { bookId } });
      if (signal.aborted) return { ok: false, error: "aborted" };
      saved = await saveOnce();
    }
    if (!saved.ok) {
      if (saved.error === "anonymous") return { ok: false, error: "anonymous" };
      return { ok: false, error: "failed" };
    }
    return { ok: true, alignment: saved.alignment };
  } catch {
    return { ok: false, error: "failed" };
  }
}
