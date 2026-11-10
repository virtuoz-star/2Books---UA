import { useCallback, useEffect, useState } from "react";

import type { NativeLanguage } from "#/i18n/types";

import {
  addSavedWord,
  ankiDeck,
  parseSavedWordStore,
  removeSavedWord,
  type SavedWord,
} from "./saved-words";
import { bumpWordGeneration, flushWordSync, subscribeWordSync, wordSyncFailed } from "./word-sync";

const storageKey = "2books.words";

function readStored() {
  try {
    return parseSavedWordStore(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
  } catch {
    return parseSavedWordStore(null);
  }
}

function writeStored(store: ReturnType<typeof readStored>): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
    window.dispatchEvent(new Event("2books-words"));
    return true;
  } catch {
    return false;
  }
}

export function useSavedWords() {
  const [words, setWords] = useState<SavedWord[]>([]);
  const [ready, setReady] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [deviceError, setDeviceError] = useState(false);

  useEffect(() => {
    const sync = () => {
      setWords(readStored().words);
      setReady(true);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("2books-words", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("2books-words", sync);
    };
  }, []);

  useEffect(() => {
    setSyncFailed(wordSyncFailed());
    return subscribeWordSync(() => {
      setSyncFailed(wordSyncFailed());
    });
  }, []);

  const save = useCallback(
    (
      word: string,
      gloss: string,
      nativeLanguage: NativeLanguage,
      sentence: { en: string; native: string },
      place?: { bookId: string; chapterId: string; sentenceId: string; bookSource: "catalog" | "local" },
    ): boolean => {
      const ok = writeStored(
        addSavedWord(readStored(), {
          word,
          gloss,
          nativeLanguage,
          savedAt: Date.now(),
          sentenceEn: sentence.en,
          sentenceNative: sentence.native,
          bookId: place?.bookId,
          chapterId: place?.chapterId,
          sentenceId: place?.sentenceId,
          bookSource: place?.bookSource,
        }),
      );
      setDeviceError(!ok);
      if (!ok) return false;
      bumpWordGeneration();
      flushWordSync();
      return true;
    },
    [],
  );

  const remove = useCallback((word: string, nativeLanguage: NativeLanguage): boolean => {
    const ok = writeStored(removeSavedWord(readStored(), word, nativeLanguage, Date.now()));
    setDeviceError(!ok);
    if (!ok) return false;
    bumpWordGeneration();
    flushWordSync();
    return true;
  }, []);

  const restore = useCallback((word: SavedWord): boolean => {
    const ok = writeStored(addSavedWord(readStored(), word));
    setDeviceError(!ok);
    if (!ok) return false;
    bumpWordGeneration();
    flushWordSync();
    return true;
  }, []);

  return { words, ready, syncFailed, deviceError, save, remove, restore, ankiDeck };
}
