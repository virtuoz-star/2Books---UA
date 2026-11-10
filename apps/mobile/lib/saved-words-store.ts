import { Directory, File, Paths } from "expo-file-system";

import {
  addSavedWord,
  parseSavedWordStore,
  removeSavedWord,
  type SavedWord,
  type SavedWordStore,
} from "../../../src/dictionary/saved-words";
import type { NativeLanguage } from "../../../src/i18n/types";
import { shouldWriteParsedJson } from "@/lib/local-plan";
import { bumpWordGeneration, currentWordGeneration, flushWordSync } from "@/lib/word-sync";

const wordsName = "words.json";
const tmpName = "words.json.tmp";
const badName = "words.json.bad";

let chain: Promise<void> = Promise.resolve();
const wordListeners = new Set<() => void>();

export function subscribeSavedWords(listener: () => void): () => void {
  wordListeners.add(listener);
  return () => {
    wordListeners.delete(listener);
  };
}

function emitSavedWords(): void {
  for (const listener of wordListeners) listener();
}

export function withWordFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function wordsDir(): Directory {
  const dir = new Directory(Paths.document, "2books");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function isWordDocument(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  return typeof value === "object" && value !== null && "words" in value;
}

async function readParsed(file: File): Promise<SavedWordStore | "missing" | "bad" | "io"> {
  if (!file.exists) return "missing";
  let text: string;
  try {
    text = await file.text();
  } catch {
    return "io";
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isWordDocument(parsed)) return "bad";
    return parseSavedWordStore(parsed);
  } catch {
    return "bad";
  }
}

async function quarantine(file: File): Promise<void> {
  const bad = new File(wordsDir(), badName);
  if (bad.exists) throw new Error("words-unreadable");
  await file.move(bad);
}

async function readFile(): Promise<SavedWordStore> {
  const dir = wordsDir();
  const file = new File(dir, wordsName);
  const tmp = new File(dir, tmpName);
  const bad = new File(dir, badName);
  const main = await readParsed(file);
  if (main === "io") throw new Error("words-unreadable");
  if (main === "bad") {
    await quarantine(file);
    if (tmp.exists) {
      const recovered = await readParsed(tmp);
      if (typeof recovered !== "string") {
        await tmp.move(new File(dir, wordsName), { overwrite: true });
        return recovered;
      }
      if (recovered === "bad") await quarantine(tmp);
    }
    throw new Error("words-unreadable");
  }
  if (main === "missing") {
    if (bad.exists) throw new Error("words-unreadable");
    if (!tmp.exists) return parseSavedWordStore(null);
    const recovered = await readParsed(tmp);
    if (recovered === "io") throw new Error("words-unreadable");
    if (recovered === "bad") {
      await quarantine(tmp);
      throw new Error("words-unreadable");
    }
    if (recovered === "missing") return parseSavedWordStore(null);
    await tmp.move(file, { overwrite: true });
    return recovered;
  }
  if (tmp.exists) {
    try {
      tmp.delete();
    } catch {
      // The good words.json is enough. A stale tmp can stay until the next save.
    }
  }
  return main;
}

async function writeFile(store: SavedWordStore): Promise<void> {
  const disk = await readFile();
  if (!shouldWriteParsedJson(disk, store)) return;
  const dir = wordsDir();
  const tmp = new File(dir, tmpName);
  if (tmp.exists) tmp.delete();
  tmp.create({ intermediates: true });
  await tmp.write(JSON.stringify(store));
  await tmp.move(new File(dir, wordsName), { overwrite: true });
}

export function readSavedWordStore(): Promise<SavedWordStore> {
  return withWordFileLock(readFile);
}

export function replaceSavedWordStoreIfCurrent(
  store: SavedWordStore,
  at: number,
): Promise<boolean> {
  return withWordFileLock(async () => {
    if (currentWordGeneration() !== at) return false;
    await writeFile(store);
    emitSavedWords();
    return true;
  });
}

export async function loadSavedWords(): Promise<SavedWord[]> {
  return (await readSavedWordStore()).words;
}

export async function rememberWord(input: {
  word: string;
  gloss: string;
  nativeLanguage: NativeLanguage;
  sentence: { en: string; native: string };
  place?: { bookId: string; chapterId: string; sentenceId: string; bookSource: "catalog" | "local" };
}): Promise<SavedWord[]> {
  const words = await withWordFileLock(async () => {
    const next = addSavedWord(await readFile(), {
      word: input.word,
      gloss: input.gloss,
      nativeLanguage: input.nativeLanguage,
      savedAt: Date.now(),
      sentenceEn: input.sentence.en,
      sentenceNative: input.sentence.native,
      bookId: input.place?.bookId,
      chapterId: input.place?.chapterId,
      sentenceId: input.place?.sentenceId,
      bookSource: input.place?.bookSource,
    });
    await writeFile(next);
    bumpWordGeneration();
    emitSavedWords();
    return next.words;
  });
  flushWordSync();
  return words;
}

export async function forgetWord(
  word: string,
  nativeLanguage: NativeLanguage,
): Promise<SavedWord[]> {
  const words = await withWordFileLock(async () => {
    const next = removeSavedWord(await readFile(), word, nativeLanguage, Date.now());
    await writeFile(next);
    bumpWordGeneration();
    emitSavedWords();
    return next.words;
  });
  flushWordSync();
  return words;
}
