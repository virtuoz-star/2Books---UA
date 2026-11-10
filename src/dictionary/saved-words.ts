import type { NativeLanguage } from "../i18n/types";

import { normalizeWord } from "./lookup";

export const savedWordLimit = 2_000;
export const tombstoneLimit = 2_000;
const maxWordLength = 80;
const maxGlossLength = 500;
const maxSentenceLength = 2_000;
const maxTimestamp = 9_000_000_000_000;

export type BookSource = "" | "catalog" | "local";

export type SavedWord = {
  word: string;
  gloss: string;
  nativeLanguage: NativeLanguage;
  savedAt: number;
  sentenceEn: string;
  sentenceNative: string;
  /** Empty when the word was saved before the reader remembered its place. */
  bookId: string;
  chapterId: string;
  sentenceId: string;
  bookSource: BookSource;
};

export type WordTombstone = {
  word: string;
  nativeLanguage: NativeLanguage;
  deletedAt: number;
};

export type SavedWordStore = {
  words: SavedWord[];
  tombstones: WordTombstone[];
};

function isNative(value: unknown): value is NativeLanguage {
  return value === "uk" || value === "ru";
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maxTimestamp
  );
}

function sentenceText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxSentenceLength);
}

const maxPlaceId = 80;

function placeId(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > maxPlaceId) return "";
  if (!/^[\w.-]+$/.test(trimmed)) return "";
  return trimmed;
}

function bookSourceOf(value: unknown): BookSource {
  return value === "catalog" || value === "local" ? value : "";
}

function wordPlace(
  record: Record<string, unknown>,
): Pick<SavedWord, "bookId" | "chapterId" | "sentenceId" | "bookSource"> {
  const bookId = placeId(record.bookId);
  const chapterId = placeId(record.chapterId);
  const sentenceId = placeId(record.sentenceId);
  const bookSource = bookSourceOf(record.bookSource);
  if (bookId === "" || chapterId === "" || sentenceId === "" || bookSource === "") {
    return { bookId: "", chapterId: "", sentenceId: "", bookSource: "" };
  }
  return { bookId, chapterId, sentenceId, bookSource };
}

export function savedWordKey(word: string, nativeLanguage: NativeLanguage): string | null {
  const normalized = normalizeWord(word);
  if (normalized === "" || normalized.length > maxWordLength) return null;
  return `${nativeLanguage}:${normalized}`;
}

function wordFromKey(key: string, nativeLanguage: NativeLanguage): string {
  return key.slice(nativeLanguage.length + 1);
}

function asSavedWord(value: unknown): SavedWord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!isNative(record.nativeLanguage)) return null;
  if (typeof record.word !== "string" || typeof record.gloss !== "string") return null;
  if (!isTimestamp(record.savedAt)) return null;
  const key = savedWordKey(record.word, record.nativeLanguage);
  if (key === null) return null;
  return {
    word: wordFromKey(key, record.nativeLanguage),
    gloss: record.gloss.trim().slice(0, maxGlossLength),
    nativeLanguage: record.nativeLanguage,
    savedAt: record.savedAt,
    sentenceEn: sentenceText(record.sentenceEn),
    sentenceNative: sentenceText(record.sentenceNative),
    ...wordPlace(record),
  };
}

function asTombstone(value: unknown): WordTombstone | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!isNative(record.nativeLanguage)) return null;
  if (typeof record.word !== "string") return null;
  if (!isTimestamp(record.deletedAt)) return null;
  const key = savedWordKey(record.word, record.nativeLanguage);
  if (key === null) return null;
  return {
    word: wordFromKey(key, record.nativeLanguage),
    nativeLanguage: record.nativeLanguage,
    deletedAt: record.deletedAt,
  };
}

function emptyStore(): SavedWordStore {
  return { words: [], tombstones: [] };
}

function rowKey(nativeLanguage: NativeLanguage, word: string): string {
  return `${nativeLanguage}:${word}`;
}

function collectWords(value: unknown): Map<string, SavedWord> {
  const byKey = new Map<string, SavedWord>();
  if (!Array.isArray(value)) return byKey;
  for (const item of value) {
    const word = asSavedWord(item);
    if (word === null) continue;
    const key = rowKey(word.nativeLanguage, word.word);
    const previous = byKey.get(key);
    if (previous === undefined || word.savedAt >= previous.savedAt) byKey.set(key, word);
  }
  return byKey;
}

function collectTombstones(value: unknown): Map<string, WordTombstone> {
  const byKey = new Map<string, WordTombstone>();
  if (!Array.isArray(value)) return byKey;
  for (const item of value) {
    const tombstone = asTombstone(item);
    if (tombstone === null) continue;
    const key = rowKey(tombstone.nativeLanguage, tombstone.word);
    const previous = byKey.get(key);
    if (previous === undefined || tombstone.deletedAt >= previous.deletedAt)
      byKey.set(key, tombstone);
  }
  return byKey;
}

function finishStore(
  words: Map<string, SavedWord>,
  tombstones: Map<string, WordTombstone>,
): SavedWordStore {
  for (const [key, tombstone] of tombstones) {
    const word = words.get(key);
    if (word === undefined) continue;
    if (tombstone.deletedAt >= word.savedAt) words.delete(key);
    else tombstones.delete(key);
  }
  return {
    words: [...words.values()]
      .sort((left, right) => right.savedAt - left.savedAt || left.word.localeCompare(right.word))
      .slice(0, savedWordLimit),
    tombstones: [...tombstones.values()]
      .sort(
        (left, right) => right.deletedAt - left.deletedAt || left.word.localeCompare(right.word),
      )
      .slice(0, tombstoneLimit),
  };
}

/** Client clocks can run ahead. The server clamps stamps to a few minutes past its own clock. */
export function clampSavedWordTimes(store: SavedWordStore, now: number): SavedWordStore {
  const cap = now + 5 * 60_000;
  return {
    words: store.words.map((word) => ({ ...word, savedAt: Math.min(word.savedAt, cap) })),
    tombstones: store.tombstones.map((tomb) => ({
      ...tomb,
      deletedAt: Math.min(tomb.deletedAt, cap),
    })),
  };
}

export function parseSavedWordStore(value: unknown): SavedWordStore {
  if (Array.isArray(value)) return finishStore(collectWords(value), new Map());
  if (typeof value === "object" && value !== null && "words" in value) {
    const record = value as Record<string, unknown>;
    return finishStore(collectWords(record.words), collectTombstones(record.tombstones));
  }
  return emptyStore();
}

export function parseSavedWords(value: unknown): SavedWord[] {
  return parseSavedWordStore(value).words;
}

export function addSavedWord(
  store: SavedWordStore,
  input: {
    word: string;
    gloss: string;
    nativeLanguage: NativeLanguage;
    savedAt: number;
    sentenceEn: string;
    sentenceNative: string;
    bookId?: string;
    chapterId?: string;
    sentenceId?: string;
    bookSource?: BookSource;
  },
): SavedWordStore {
  const parsed = parseSavedWordStore(store);
  const next = asSavedWord(input);
  if (next === null) return parsed;
  const key = rowKey(next.nativeLanguage, next.word);
  return parseSavedWordStore({
    words: [...parsed.words.filter((item) => rowKey(item.nativeLanguage, item.word) !== key), next],
    tombstones: parsed.tombstones.filter((item) => rowKey(item.nativeLanguage, item.word) !== key),
  });
}

export function removeSavedWord(
  store: SavedWordStore,
  word: string,
  nativeLanguage: NativeLanguage,
  deletedAt: number,
): SavedWordStore {
  const parsed = parseSavedWordStore(store);
  const key = savedWordKey(word, nativeLanguage);
  if (key === null || !isTimestamp(deletedAt)) return parsed;
  return parseSavedWordStore({
    words: parsed.words.filter((item) => rowKey(item.nativeLanguage, item.word) !== key),
    tombstones: [
      ...parsed.tombstones.filter((item) => rowKey(item.nativeLanguage, item.word) !== key),
      { word: wordFromKey(key, nativeLanguage), nativeLanguage, deletedAt },
    ],
  });
}

export function hasSavedWord(
  words: readonly SavedWord[],
  word: string,
  nativeLanguage: NativeLanguage,
): boolean {
  const key = savedWordKey(word, nativeLanguage);
  if (key === null) return false;
  return words.some((item) => rowKey(item.nativeLanguage, item.word) === key);
}

type MergeCandidate = { kind: "live"; word: SavedWord } | { kind: "tomb"; tomb: WordTombstone };

function candidateTime(candidate: MergeCandidate): number {
  return candidate.kind === "live" ? candidate.word.savedAt : candidate.tomb.deletedAt;
}

function liveIsGreater(left: SavedWord, right: SavedWord): boolean {
  if (left.gloss > right.gloss) return true;
  if (right.gloss > left.gloss) return false;
  if (left.sentenceEn > right.sentenceEn) return true;
  if (right.sentenceEn > left.sentenceEn) return false;
  if (left.sentenceNative > right.sentenceNative) return true;
  if (right.sentenceNative > left.sentenceNative) return false;
  return left.bookId !== "" && right.bookId === "";
}

function preferCandidate(first: MergeCandidate, second: MergeCandidate): MergeCandidate {
  const firstTime = candidateTime(first);
  const secondTime = candidateTime(second);
  if (secondTime > firstTime) return second;
  if (firstTime > secondTime) return first;
  if (first.kind !== second.kind) return first.kind === "tomb" ? first : second;
  if (first.kind === "tomb" || second.kind === "tomb") return second;
  if (liveIsGreater(second.word, first.word)) return second;
  if (liveIsGreater(first.word, second.word)) return first;
  return second;
}

function indexStore(store: SavedWordStore): Map<string, MergeCandidate> {
  const indexed = new Map<string, MergeCandidate>();
  for (const word of store.words)
    indexed.set(rowKey(word.nativeLanguage, word.word), { kind: "live", word });
  for (const tomb of store.tombstones) {
    indexed.set(rowKey(tomb.nativeLanguage, tomb.word), { kind: "tomb", tomb });
  }
  return indexed;
}

export function mergeWordStores(local: SavedWordStore, remote: SavedWordStore): SavedWordStore {
  const left = indexStore(parseSavedWordStore(local));
  const right = indexStore(parseSavedWordStore(remote));
  const words: SavedWord[] = [];
  const tombstones: WordTombstone[] = [];
  const keys = new Set<string>([...left.keys(), ...right.keys()]);
  for (const key of keys) {
    const first = left.get(key);
    const second = right.get(key);
    const winner =
      first === undefined ? second : second === undefined ? first : preferCandidate(first, second);
    if (winner === undefined) continue;
    if (winner.kind === "live") words.push(winner.word);
    else tombstones.push(winner.tomb);
  }
  return parseSavedWordStore({ words, tombstones });
}

function ankiField(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

function quoteAnkiField(value: string): string {
  if (!/["\n\r\t]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

/** Anki text import: Basic notes. Front is the word. Back joins the present parts. */
export function ankiDeck(words: readonly SavedWord[]): string {
  const lines = ["#separator:tab", "#html:false", "#notetype:Basic", "#deck:2books"];
  for (const word of words) {
    const parts = [word.gloss, word.sentenceEn, word.sentenceNative]
      .map((part) => ankiField(part))
      .filter((part) => part !== "");
    lines.push(`${quoteAnkiField(ankiField(word.word))}\t${quoteAnkiField(parts.join("\n\n"))}`);
  }
  return `${lines.join("\n")}\n`;
}
