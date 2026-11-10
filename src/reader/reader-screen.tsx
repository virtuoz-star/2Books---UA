import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  createElement,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "#/components/ui/button";
import { Field, Input } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { Toast, ToastProvider } from "#/components/ui/toast";
import { TranslateJobStatus } from "#/components/translate-job-status";
import type { Book } from "#/content/catalog";
import { readGoogleTranslateKey } from "#/dictionary/google-key";
import { postGoogleTranslate } from "#/dictionary/google-request";
import { lookupWord, normalizeWord } from "#/dictionary/lookup";
import { hasSavedWord, savedWordKey } from "#/dictionary/saved-words";
import {
  noticeFromUpload,
  translateOwnedUpload,
  type OwnedUploadNotice,
} from "#/dictionary/translate-upload";
import { useSavedWords } from "#/dictionary/use-saved-words";
import { message, nextPartLabel, partLabel, partSummaryLabel, translationStatus } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import { deleteMyBook, renameMyBook, saveProgress, type ReadingProgress } from "#/library/api";
import { maxTitleLength } from "#/library/upload-input";
import {
  loadBrowserProgress,
  preferProgress,
  progressForOpenedChapter,
  saveBrowserProgress,
  type LocalProgress,
} from "#/reader/progress";
import {
  selectSentence,
  selectWord,
  clearSelection,
  type SelectionState,
} from "#/reader/selection";
import { StudyPanel } from "#/reader/study-panel";
import { sentenceTokens, type SentenceToken } from "#/reader/tokens";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { SettingsMenu } from "#/shell/settings-menu";

const tokenCache = new Map<string, SentenceToken[]>();

let followedBookId: string | null = null;

function tokensFor(id: string, text: string): SentenceToken[] {
  const key = `${id}\u0000${text}`;
  const cached = tokenCache.get(key);
  if (cached) return cached;
  const tokens = sentenceTokens(text);
  tokenCache.set(key, tokens);
  return tokens;
}

export type ReaderSentence = {
  id: string;
  en: string;
  uk: string;
  ru: string;
  paragraph?: number;
};

export type ReaderChapter = {
  id: string;
  title: string | Record<Locale, string>;
  sentences: readonly ReaderSentence[];
};

export type ReaderBook = {
  id: string;
  author?: string;
  title: string | Record<Locale, string>;
  chapters: readonly ReaderChapter[];
};

function localized(value: string | Record<Locale, string>, locale: Locale): string {
  if (typeof value === "string") return value;
  return value[locale];
}

function wordIndexFromTarget(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const node = target.closest("[data-word-index]");
  if (!(node instanceof HTMLElement)) return null;
  const raw = node.dataset.wordIndex;
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function sentenceForLine(
  sentence: ReaderSentence,
  patches: Readonly<Record<string, { uk: string; ru: string }>>,
): ReaderSentence {
  const patch = patches[sentence.id];
  if (!patch) return sentence;
  return { ...sentence, uk: patch.uk, ru: patch.ru };
}

function shownTranslation(
  sentence: ReaderSentence,
  nativeLanguage: NativeLanguage,
): { text: string; lang: NativeLanguage } | null {
  if (sentence[nativeLanguage] !== "") return { text: sentence[nativeLanguage], lang: nativeLanguage };
  const other: NativeLanguage = nativeLanguage === "uk" ? "ru" : "uk";
  if (sentence[other] !== "") return { text: sentence[other], lang: other };
  return null;
}

function paragraphNumber(sentence: ReaderSentence): number {
  if (
    typeof sentence.paragraph !== "number" ||
    !Number.isInteger(sentence.paragraph) ||
    sentence.paragraph < 0
  ) {
    return 0;
  }
  return sentence.paragraph;
}

function paragraphGroups(sentences: readonly ReaderSentence[]): {
  key: string;
  paragraph: number;
  sentences: { sentence: ReaderSentence; index: number }[];
}[] {
  const groups: {
    key: string;
    paragraph: number;
    sentences: { sentence: ReaderSentence; index: number }[];
  }[] = [];
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    if (!sentence) continue;
    const paragraph = paragraphNumber(sentence);
    const last = groups[groups.length - 1];
    if (!last || last.paragraph !== paragraph) {
      groups.push({
        key: `${paragraph}:${sentence.id}`,
        paragraph,
        sentences: [{ sentence, index }],
      });
    } else {
      last.sentences.push({ sentence, index });
    }
  }
  return groups;
}

function isSubhead(text: string, count: number, paragraphIndex: number): boolean {
  if (paragraphIndex > 2 || count !== 1) return false;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return false;
  if (trimmed !== trimmed.toUpperCase()) return false;
  return /[A-Z]/.test(trimmed);
}

function chapterNumber(chapterId: string): number {
  const match = /^c(\d+)$/.exec(chapterId);
  return match ? Number(match[1]) : 1;
}

function focusSentence(id: string): void {
  const node = document.querySelector(`[data-sentence-id="${CSS.escape(id)}"]`);
  if (node instanceof HTMLElement) node.focus();
}

function collapsedSelection(): boolean {
  const selected = window.getSelection();
  if (selected === null) return true;
  return selected.isCollapsed || selected.toString().trim() === "";
}

type UploadPanel = {
  alignment: "pending" | "ready";
  running: boolean;
  progress: { done: number; total: number } | null;
  notice: OwnedUploadNotice | null;
  onStart: () => void;
  onCancel: () => void;
};

export function ReaderScreen({
  bookId,
  book,
  chapterId,
  nativeLanguage,
  signedIn,
  progress,
  linkedSentence = null,
  upload: initialUpload,
}: {
  bookId: string;
  book: ReaderBook | Book;
  chapterId: string;
  nativeLanguage: NativeLanguage;
  signedIn: boolean;
  progress: ReadingProgress | null;
  linkedSentence?: string | null;
  upload: { alignment: "pending" | "ready" } | null;
}) {
  const router = useRouter();
  const [patchBookId, setPatchBookId] = useState(bookId);
  const [patches, setPatches] = useState<Record<string, { uk: string; ru: string }>>({});
  const [alignment, setAlignment] = useState<"pending" | "ready" | null>(initialUpload?.alignment ?? null);
  const [running, setRunning] = useState(false);
  const [jobProgress, setJobProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<OwnedUploadNotice | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  if (patchBookId !== bookId) {
    setPatchBookId(bookId);
    setPatches({});
    setAlignment(initialUpload?.alignment ?? null);
    setRunning(false);
    setJobProgress(null);
    setNotice(null);
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [bookId]);

  useEffect(() => {
    if (!running) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [running]);

  const cancelUpload = () => {
    abortRef.current?.abort();
    setRunning(false);
    setJobProgress(null);
    setNotice(null);
  };

  const startUpload = () => {
    if (running || alignment === null) return;
    const key = readGoogleTranslateKey();
    if (key.length === 0) {
      setNotice({ kind: "need-key" });
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setRunning(true);
    setNotice(null);
    setJobProgress(null);
    void translateOwnedUpload({
      bookId,
      again: alignment === "ready",
      key,
      signal: controller.signal,
      onProgress: (done, total) => {
        if (controller.signal.aborted || total < 1) return;
        setJobProgress({ done, total });
      },
    }).then((result) => {
      if (controller.signal.aborted) return;
      setRunning(false);
      setJobProgress(null);
      setNotice(noticeFromUpload(result));
      if (!result.ok) return;
      setAlignment(result.alignment);
      setPatches((current) => {
        const next = { ...current };
        for (const pair of result.pairs) next[pair.id] = { uk: pair.uk, ru: pair.ru };
        return next;
      });
      void router.invalidate();
    });
  };

  const upload: UploadPanel | null =
    alignment !== null
      ? { alignment, running, progress: jobProgress, notice, onStart: startUpload, onCancel: cancelUpload }
      : null;

  return (
    <ToastProvider>
      <ChapterReading
        key={`${bookId}:${chapterId}`}
        bookId={bookId}
        book={book}
        chapterId={chapterId}
        nativeLanguage={nativeLanguage}
        signedIn={signedIn}
        initialProgress={progress}
        linkedSentence={linkedSentence ?? null}
        patches={patches}
        upload={upload}
      />
    </ToastProvider>
  );
}

function ChapterReading({
  bookId,
  book,
  chapterId,
  nativeLanguage,
  signedIn,
  initialProgress,
  linkedSentence,
  patches,
  upload,
}: {
  bookId: string;
  book: ReaderBook | Book;
  chapterId: string;
  nativeLanguage: NativeLanguage;
  signedIn: boolean;
  initialProgress: ReadingProgress | null;
  linkedSentence: string | null;
  patches: Readonly<Record<string, { uk: string; ru: string }>>;
  upload: UploadPanel | null;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const { settings, updateSettings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const chapterIndex = book.chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = chapterIndex >= 0 ? book.chapters[chapterIndex] : undefined;
  const [selection, setSelection] = useState<SelectionState>({ selectedId: null });
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [barHidden, setBarHidden] = useState(false);
  const [live, setLive] = useState("");
  const [undo, setUndo] = useState<{ word: string } | null>(null);
  const partKey = `${bookId}\0${chapterId}`;
  const [partKeySeen, setPartKeySeen] = useState(partKey);
  const [openedIds, setOpenedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [partSavedKeys, setPartSavedKeys] = useState<readonly string[]>([]);
  if (partKeySeen !== partKey) {
    setPartKeySeen(partKey);
    setOpenedIds(new Set());
    setPartSavedKeys([]);
  }
  const sentences = chapter?.sentences ?? [];
  const sentenceIdList = sentences.map((sentence) => sentence.id).join("\0");
  const groups = useMemo(() => paragraphGroups(sentences), [sentences]);
  const selectedIndex = sentences.findIndex((sentence) => sentence.id === selection.selectedId);
  const selected = selectedIndex >= 0 ? sentences[selectedIndex] : undefined;
  const selectedLine = selected ? sentenceForLine(selected, patches) : undefined;
  const selectedWord =
    selected && typeof selection.wordIndex === "number"
      ? tokensFor(selected.id, selected.en).find(
          (token) => token.kind === "word" && token.index === selection.wordIndex,
        )
      : undefined;
  const gloss =
    selectedWord?.kind === "word" ? lookupWord(selectedWord.text, nativeLanguage) : null;
  const saved = useSavedWords();
  const savedWords = useMemo(() => {
    const marks = new Set<string>();
    for (const item of saved.words) {
      if (item.nativeLanguage !== nativeLanguage) continue;
      const normalized = normalizeWord(item.word);
      if (normalized !== "") marks.add(normalized);
    }
    return marks;
  }, [saved.words, nativeLanguage]);
  const wordSaved =
    selectedWord?.kind === "word" && hasSavedWord(saved.words, selectedWord.text, nativeLanguage);
  const keyboardClick = useRef(false);
  const lastSave = useRef({ key: "", at: 0 });
  const articleRef = useRef<HTMLElement | null>(null);

  const savePosition = (sentenceId: string | null, force: boolean) => {
    const entry: LocalProgress = {
      bookId,
      chapterId,
      sentenceId,
      updatedAt: Date.now(),
    };
    const key = `${chapterId}:${sentenceId ?? ""}`;
    if (!force && lastSave.current.key === key && entry.updatedAt - lastSave.current.at < 1500) return;
    lastSave.current = { key, at: entry.updatedAt };
    saveBrowserProgress(entry);
    if (!signedIn) return;
    try {
      const pending = saveProgress({ data: { bookId, chapterId, sentenceId } });
      void Promise.resolve(pending)
        .then((result) => {
          if (!result.ok) return;
          void router.invalidate({ filter: (match) => match.routeId === "/" });
        })
        .catch(() => {});
    } catch {
      // Ignore a failed progress write.
    }
  };
  const saveRef = useRef(savePosition);
  saveRef.current = savePosition;
  const restoringScroll = useRef(false);
  const restoredKey = useRef("");

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const narrow = window.matchMedia("(max-width: 639px)").matches;
      if (!narrow) {
        setBarHidden(false);
        last = y;
        return;
      }
      if (y > last + 8 && y > 64) setBarHidden(true);
      else if (y < last - 8) setBarHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const local = loadBrowserProgress(bookId);
    const remote = initialProgress && initialProgress.bookId === bookId ? initialProgress : null;
    const localForBook = local && local.bookId === bookId ? local : null;
    const chosen = preferProgress(localForBook, remote);
    if (followedBookId !== bookId) {
      followedBookId = bookId;
      if (signedIn && localForBook && (!remote || localForBook.updatedAt > remote.updatedAt)) {
        void saveProgress({
          data: {
            bookId,
            chapterId: localForBook.chapterId,
            sentenceId: localForBook.sentenceId,
          },
        })
          .then((result) => {
            if (result.ok) void router.invalidate({ filter: (match) => match.routeId === "/" });
          })
          .catch(() => {});
      }
      const linkedHere =
        linkedSentence !== null &&
        linkedSentence !== "" &&
        sentenceIdList.split("\0").includes(linkedSentence)
          ? linkedSentence
          : null;
      if (!linkedHere && chosen && chosen.chapterId !== chapterId && chosen.chapterId !== "") {
        void navigate({
          to: "/books/$bookId/$chapterId",
          params: { bookId, chapterId: chosen.chapterId },
          replace: true,
        });
        return;
      }
    }
    const linkedHere =
      linkedSentence !== null &&
      linkedSentence !== "" &&
      sentenceIdList.split("\0").includes(linkedSentence)
        ? linkedSentence
        : null;
    if (!linkedHere) {
      const opening = progressForOpenedChapter(chosen, bookId, chapterId, Date.now());
      if (opening) saveRef.current(null, true);
    }
    const here = linkedHere ?? (chosen && chosen.chapterId === chapterId ? chosen.sentenceId : null);
    if (linkedHere) saveRef.current(linkedHere, true);
    if (here === null || here === "") return;
    const restoreKey = `${bookId}\0${chapterId}\0${here}`;
    if (restoredKey.current === restoreKey) return;
    if (document.activeElement?.closest("[data-radix-popper-content-wrapper], [role='dialog']")) return;
    restoredKey.current = restoreKey;
    let moved = false;
    const arm = () => {
      moved = true;
    };
    window.addEventListener("wheel", arm, { passive: true });
    window.addEventListener("touchmove", arm, { passive: true });
    window.addEventListener("pointerdown", arm);
    const timer = window.setTimeout(() => {
      if (moved || window.scrollY > 8) return;
      const node = document.querySelector(`[data-sentence-id="${CSS.escape(here)}"]`);
      if (!(node instanceof HTMLElement)) return;
      restoringScroll.current = true;
      node.scrollIntoView({ block: "start" });
      setCursorId(here);
      node.focus({ preventScroll: true });
      window.setTimeout(() => {
        restoringScroll.current = false;
      }, 500);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", arm);
      window.removeEventListener("touchmove", arm);
      window.removeEventListener("pointerdown", arm);
    };
  }, [bookId, chapterId, initialProgress, linkedSentence, navigate, router, sentenceIdList, signedIn]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    let timer = 0;
    let pendingId: string | null = null;
    let armed = false;
    const arm = () => {
      armed = true;
    };
    window.addEventListener("wheel", arm, { passive: true });
    window.addEventListener("touchmove", arm, { passive: true });
    const onScroll = () => {
      if (!restoringScroll.current) armed = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!armed) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        const id = visible[0]?.target.getAttribute("data-sentence-id");
        if (!id) return;
        pendingId = id;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          if (pendingId) saveRef.current(pendingId, false);
        }, 400);
      },
      { root: null, rootMargin: "-72px 0px -55% 0px", threshold: [0, 0.25, 0.6] },
    );
    for (const node of article.querySelectorAll("[data-sentence-id]")) observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("wheel", arm);
      window.removeEventListener("touchmove", arm);
      window.removeEventListener("scroll", onScroll);
    };
  }, [bookId, chapterId, sentences.length]);

  useEffect(() => {
    if (!selected) return;
    const node = document.querySelector(`[data-sentence-id="${CSS.escape(selected.id)}"]`);
    const panel = document.getElementById("study-panel");
    if (!(node instanceof HTMLElement) || panel === null) return;
    const rect = node.getBoundingClientRect();
    const limit = panel.getBoundingClientRect().top;
    if (rect.bottom > limit - 8 || rect.top < 64) node.scrollIntoView({ block: "start" });
  }, [selected]);

  useEffect(() => {
    if (selection.selectedId === null || settings.hintSeen) return;
    updateSettings({ ...settings, hintSeen: true });
  }, [selection.selectedId, settings, updateSettings]);

  useEffect(() => {
    if (!selectedLine) return;
    const shown = shownTranslation(selectedLine, nativeLanguage);
    if (shown) setLive(translationStatus(locale, shown.text));
  }, [selectedLine, nativeLanguage, locale]);

  const noteOpened = (id: string) => {
    const sentence = sentences.find((item) => item.id === id);
    if (!sentence) return;
    if (!shownTranslation(sentenceForLine(sentence, patches), nativeLanguage)) return;
    setOpenedIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };
  const chooseSentence = (id: string) => {
    const next = selectSentence(selection, id);
    setSelection(next);
    setCursorId(id);
    if (next.selectedId) saveRef.current(next.selectedId, true);
    noteOpened(id);
  };
  const chooseWord = (sentenceId: string, wordIndex: number) => {
    const next = selectWord(selection, sentenceId, wordIndex);
    setSelection(next);
    if (next.selectedId && next.selectedId !== selection.selectedId) {
      saveRef.current(next.selectedId, true);
      noteOpened(sentenceId);
    }
  };
  const actions = useRef({ chooseSentence, chooseWord });
  actions.current = { chooseSentence, chooseWord };
  const onSentence = useCallback((id: string) => {
    actions.current.chooseSentence(id);
  }, []);
  const onWord = useCallback((sentenceId: string, wordIndex: number) => {
    actions.current.chooseWord(sentenceId, wordIndex);
  }, []);

  const dismiss = () => {
    const id = selection.selectedId;
    if (id === null) return;
    setSelection(clearSelection());
    requestAnimationFrame(() => focusSentence(id));
  };

  const normalized = selectedWord?.kind === "word" ? normalizeWord(selectedWord.text) : "";
  const translateIdentity = `${selection.selectedId ?? ""}:${selection.wordIndex ?? ""}:${nativeLanguage}:${normalized}`;
  const translateAbort = useRef<AbortController | null>(null);
  const translateRequest = useRef(0);
  const [googleLine, setGoogleLine] = useState<{ key: string; text: string } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateFailed, setTranslateFailed] = useState(false);
  const [googleKey, setGoogleKey] = useState("");
  const speechGeneration = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechStarted = useRef(false);
  const [speechReady, setSpeechReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [readingPart, setReadingPart] = useState(false);
  const readGeneration = useRef(0);
  const [speakFailed, setSpeakFailed] = useState(false);

  useEffect(() => {
    const sync = () => setGoogleKey(readGoogleTranslateKey());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("2books-google-key", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("2books-google-key", sync);
    };
  }, []);

  useEffect(() => {
    setSpeechReady(
      typeof window.speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined",
    );
  }, []);

  useEffect(() => {
    setSpeakFailed(false);
    return () => {
      speechGeneration.current += 1;
      utteranceRef.current = null;
      setSpeaking(false);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        console.error("speech");
      }
    };
  }, [selection.selectedId]);

  useEffect(() => {
    translateRequest.current += 1;
    translateAbort.current?.abort();
    translateAbort.current = null;
    setGoogleLine(null);
    setTranslating(false);
    setTranslateFailed(false);
    return () => {
      translateRequest.current += 1;
      translateAbort.current?.abort();
    };
  }, [translateIdentity]);

  const runTranslate = () => {
    if (normalized === "" || translating) return;
    const key = readGoogleTranslateKey();
    if (key.length === 0) return;
    const controller = new AbortController();
    translateAbort.current?.abort();
    translateAbort.current = controller;
    const id = ++translateRequest.current;
    const wordKey = translateIdentity;
    setTranslating(true);
    setTranslateFailed(false);
    setLive(message(locale, "translating"));
    void postGoogleTranslate({
      key,
      q: [normalized],
      target: nativeLanguage,
      signal: controller.signal,
      timeoutMs: 15_000,
    })
      .then((result) => {
        if (id !== translateRequest.current) return;
        setTranslating(false);
        if (!result.ok) {
          if (result.status !== "aborted") setTranslateFailed(true);
          return;
        }
        const text = result.rows[0]?.text ?? null;
        if (text === null || text === "") {
          setTranslateFailed(true);
          return;
        }
        setGoogleLine({ key: wordKey, text });
        setLive(translationStatus(locale, text));
      })
      .catch(() => {
        if (id !== translateRequest.current) return;
        setTranslating(false);
        setTranslateFailed(true);
      });
  };

  useEffect(() => {
    if (normalized === "" || gloss !== null || googleKey.length === 0) return;
    const key = googleKey;
    const controller = new AbortController();
    translateAbort.current?.abort();
    translateAbort.current = controller;
    const id = ++translateRequest.current;
    const wordKey = translateIdentity;
    setTranslating(true);
    setTranslateFailed(false);
    setLive(message(locale, "translating"));
    void postGoogleTranslate({
      key,
      q: [normalized],
      target: nativeLanguage,
      signal: controller.signal,
      timeoutMs: 15_000,
    })
      .then((result) => {
        if (id !== translateRequest.current) return;
        setTranslating(false);
        if (!result.ok) {
          if (result.status !== "aborted") setTranslateFailed(true);
          return;
        }
        const text = result.rows[0]?.text ?? null;
        if (text === null || text === "") {
          setTranslateFailed(true);
          return;
        }
        setGoogleLine({ key: wordKey, text });
        setLive(translationStatus(locale, text));
      })
      .catch(() => {
        if (id !== translateRequest.current) return;
        setTranslating(false);
        setTranslateFailed(true);
      });
    return () => {
      controller.abort();
    };
  }, [gloss, googleKey, locale, nativeLanguage, normalized, translateIdentity]);

  const stopSpeech = () => {
    speechGeneration.current += 1;
    readGeneration.current += 1;
    utteranceRef.current = null;
    setSpeaking(false);
    setReadingPart(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      console.error("speech");
      setSpeakFailed(true);
    }
  };

  const speakText = (
    text: string,
    options?: { rate?: number; chain?: boolean; onEnd?: () => void },
  ) => {
    if (!speechReady || text.trim() === "") return;
    if (speaking && !options?.chain) {
      readGeneration.current += 1;
      setReadingPart(false);
      stopSpeech();
      return;
    }
    const id = ++speechGeneration.current;
    setSpeakFailed(false);
    setSpeaking(true);
    speechStarted.current = false;
    try {
      window.speechSynthesis.cancel();
    } catch {
      console.error("speech");
      setSpeaking(false);
      setSpeakFailed(true);
      return;
    }
    const watchdog = window.setTimeout(() => {
      if (id !== speechGeneration.current || speechStarted.current) return;
      setSpeaking(false);
      setSpeakFailed(true);
    }, 4000);
    window.setTimeout(() => {
      if (id !== speechGeneration.current) return;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = options?.rate ?? 1;
        utteranceRef.current = utterance;
        utterance.onstart = () => {
          speechStarted.current = true;
        };
        const finish = (ended: boolean) => {
          window.clearTimeout(watchdog);
          if (id !== speechGeneration.current) return;
          utteranceRef.current = null;
          setSpeaking(false);
          if (ended) options?.onEnd?.();
        };
        utterance.onend = () => {
          finish(true);
        };
        utterance.onerror = (event) => {
          const errorName = "error" in event && typeof event.error === "string" ? event.error : "";
          if (id === speechGeneration.current && errorName !== "canceled" && errorName !== "interrupted") {
            setSpeakFailed(true);
          }
          finish(false);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        window.clearTimeout(watchdog);
        if (id !== speechGeneration.current) return;
        console.error("speech");
        setSpeaking(false);
        setSpeakFailed(true);
      }
    }, 0);
  };

  const readPart = () => {
    if (readingPart) {
      stopSpeech();
      return;
    }
    const start = sentences.findIndex((sentence) => sentence.id === (selection.selectedId ?? cursorId));
    const generation = ++readGeneration.current;
    setReadingPart(true);
    const step = (index: number) => {
      if (generation !== readGeneration.current) return;
      const sentence = sentences[index];
      if (!sentence) {
        setReadingPart(false);
        return;
      }
      if (sentence.en.trim() === "") {
        step(index + 1);
        return;
      }
      setSelection({ selectedId: sentence.id, wordIndex: null });
      setCursorId(sentence.id);
      const node = document.querySelector(`[data-sentence-id="${CSS.escape(sentence.id)}"]`);
      if (node instanceof HTMLElement) {
        restoringScroll.current = true;
        node.scrollIntoView({ block: "center" });
        window.setTimeout(() => {
          restoringScroll.current = false;
        }, 500);
      }
      speakText(sentence.en, { rate: 0.75, chain: true, onEnd: () => step(index + 1) });
    };
    step(start < 0 ? 0 : start);
  };

  const pendingChapterId = useRouterState({
    select: (state) => {
      if (state.status !== "pending") return null;
      const last = state.location.pathname.split("/").pop() ?? "";
      return /^c\d+$/.test(last) ? last : null;
    },
  });

  const moveSentence = (delta: number) => {
    const currentId = cursorId ?? selection.selectedId ?? sentences[0]?.id ?? null;
    const index = sentences.findIndex((sentence) => sentence.id === currentId);
    const next = sentences[index + delta];
    if (!next) return;
    setCursorId(next.id);
    saveRef.current(next.id, false);
    requestAnimationFrame(() => focusSentence(next.id));
  };

  const moveWord = (delta: number) => {
    if (!selected) return;
    const words = tokensFor(selected.id, selected.en).filter((token) => token.kind === "word");
    if (words.length === 0) return;
    const current = typeof selection.wordIndex === "number" ? selection.wordIndex : -1;
    const indexes = words.map((token) => token.index);
    const position = indexes.indexOf(current);
    const nextPosition =
      delta > 0 ? (position < 0 ? 0 : Math.min(indexes.length - 1, position + 1)) : Math.max(0, position - 1);
    const nextIndex = indexes[nextPosition];
    if (nextIndex === undefined) return;
    setSelection({ selectedId: selected.id, wordIndex: nextIndex });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (event.defaultPrevented) return;
    if (target.closest("input, textarea, select, [role='dialog'], [role='menu']")) return;
    if (event.key === "Escape") {
      if (selection.selectedId === null) return;
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === "KeyL") {
      event.preventDefault();
      if (selected) speakText(selected.en);
      return;
    }
    if (event.code === "KeyS") {
      event.preventDefault();
      toggleSave();
      return;
    }
    const sentenceEl = target.closest("[data-sentence-id]");
    if (!(sentenceEl instanceof HTMLElement)) return;
    const id = sentenceEl.dataset.sentenceId;
    if (!id) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      keyboardClick.current = true;
      window.setTimeout(() => {
        keyboardClick.current = false;
      }, 300);
      chooseSentence(id);
      return;
    }
    if (event.key === "ArrowUp" || event.code === "KeyK") {
      event.preventDefault();
      moveSentence(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.code === "KeyJ") {
      event.preventDefault();
      moveSentence(1);
      return;
    }
    if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && selection.selectedId === id) {
      event.preventDefault();
      moveWord(event.key === "ArrowRight" ? 1 : -1);
    }
  };

  const toggleSave = () => {
    if (!selected || selectedWord?.kind !== "word") return;
    const surface = selectedWord.text;
    if (wordSaved) {
      const ok = saved.remove(surface, nativeLanguage);
      if (ok) setLive(message(locale, "wordRemovedStatus"));
      return;
    }
    const shown = selectedLine ? shownTranslation(selectedLine, nativeLanguage) : null;
    const googleText = googleLine !== null && googleLine.key === translateIdentity ? googleLine.text : "";
    const glossText = googleText !== "" ? googleText : (gloss ?? "");
    const ok = saved.save(
      surface,
      glossText,
      nativeLanguage,
      {
        en: selected.en,
        native: shown?.text ?? "",
      },
      {
        bookId,
        chapterId,
        sentenceId: selected.id,
        bookSource: "catalog",
      },
    );
    if (!ok) return;
    const savedKey = savedWordKey(surface, nativeLanguage);
    if (savedKey !== null) {
      setPartSavedKeys((current) => (current.includes(savedKey) ? current : [...current, savedKey]));
    }
    setLive(message(locale, "wordSavedStatus"));
    setUndo({ word: surface });
  };

  if (!chapter) return null;

  const previous = chapterIndex > 0 ? book.chapters[chapterIndex - 1] : undefined;
  const next =
    chapterIndex >= 0 && chapterIndex < book.chapters.length - 1
      ? book.chapters[chapterIndex + 1]
      : undefined;
  const partTotal = book.chapters.length;
  const partNumber = chapterIndex >= 0 ? chapterIndex + 1 : chapterNumber(chapterId);
  const shownChapterId = pendingChapterId ?? chapter.id;
  const hasTranslation = sentences.some((sentence) => {
    const line = sentenceForLine(sentence, patches);
    return line.uk !== "" || line.ru !== "";
  });
  const translation = selectedLine ? shownTranslation(selectedLine, nativeLanguage) : null;
  const googleText = googleLine !== null && googleLine.key === translateIdentity ? googleLine.text : null;
  const googleUrl = `https://translate.google.com/?sl=en&tl=${nativeLanguage}&text=${encodeURIComponent(normalized)}`;
  const tabStopId = cursorId ?? sentences[0]?.id ?? null;
  const progressRatio = partTotal > 0 ? partNumber / partTotal : 0;

  return (
    <div className="flex flex-col gap-6" onKeyDown={onKeyDown}>
      <div className="reader-bar" data-hidden={barHidden ? "true" : "false"}>
        <Link to="/" className="icon-btn btn btn-quiet" aria-label={message(locale, "backToBooks")}>
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{localized(book.title, locale)}</p>
          <details className="contents-menu">
            <summary className="cursor-pointer text-xs text-muted-foreground" aria-busy={pendingChapterId !== null}>
              {partLabel(locale, partNumber, partTotal)}
            </summary>
            <nav aria-label={message(locale, "navParts")} className="contents-list">
              <ul className="m-0 list-none p-0">
                {book.chapters.map((item, index) => (
                  <li key={item.id}>
                    <Link
                      to="/books/$bookId/$chapterId"
                      params={{ bookId, chapterId: item.id }}
                      aria-current={item.id === shownChapterId ? "page" : undefined}
                      className="block px-2 py-1 text-sm text-foreground no-underline hover:bg-muted"
                    >
                      {partLabel(locale, index + 1, partTotal)} · {localized(item.title, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
        {previous ? (
          <Link
            to="/books/$bookId/$chapterId"
            params={{ bookId, chapterId: previous.id }}
            className="icon-btn btn btn-quiet"
            aria-label={message(locale, "previousChapter")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : null}
        {next ? (
          <Link
            to="/books/$bookId/$chapterId"
            params={{ bookId, chapterId: next.id }}
            className="icon-btn btn btn-quiet"
            aria-label={message(locale, "nextChapter")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
        <SettingsMenu />
        <div className="reader-progress" aria-hidden>
          <div style={{ width: `${Math.round(progressRatio * 100)}%` }} />
        </div>
      </div>

      {upload ? (
        <OwnedTextControls
          bookId={bookId}
          title={localized(book.title, locale)}
          locale={locale}
          onRenamed={() => {
            void router.invalidate();
          }}
          onDeleted={() => {
            void navigate({ to: "/" });
          }}
        />
      ) : null}
      {upload ? (
        <TranslateJobStatus
          locale={locale}
          again={upload.alignment !== "pending"}
          running={upload.running}
          progress={upload.progress}
          notice={upload.notice}
          onStart={upload.onStart}
          onCancel={upload.onCancel}
        />
      ) : null}
      {hasTranslation ? null : (
        <Notice tone="info">
          <span className="flex flex-col items-start gap-2">
            {message(locale, "partNoTranslation")}
            {upload ? (
              <Button type="button" onClick={upload.onStart}>
                {message(locale, upload.alignment === "pending" ? "translateBook" : "translateBookAgain")}
              </Button>
            ) : null}
          </span>
        </Notice>
      )}

      <article
        ref={articleRef}
        id="reader-text"
        className="reader-article"
        lang="en"
        data-translation={settings.translationMode}
        aria-labelledby="part-heading"
      >
        {settings.hintSeen ? null : (
          <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground" lang={locale}>
            {message(locale, "hint")}
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => {
                updateSettings({ ...settings, hintSeen: true });
              }}
            >
              {message(locale, "hintDismiss")}
            </Button>
          </p>
        )}
        <h2 id="part-heading" className="display-title mb-6 text-xl text-foreground" lang={locale}>
          {localized(chapter.title, locale)}
        </h2>
        {groups.map((group, paragraphIndex) => (
          <ParagraphBlock
            key={group.key}
            group={group}
            paragraphIndex={paragraphIndex}
            activeId={selection.selectedId}
            wordIndex={typeof selection.wordIndex === "number" ? selection.wordIndex : null}
            cursorId={cursorId}
            tabStopId={tabStopId}
            nativeLanguage={nativeLanguage}
            patches={patches}
            savedWords={savedWords}
            onSentence={onSentence}
            onWord={onWord}
            keyboardClick={keyboardClick}
          />
        ))}
      </article>

      {selected ? (
        <StudyPanel
          locale={locale}
          nativeLanguage={nativeLanguage}
          translation={translation}
          word={selectedWord?.kind === "word" ? selectedWord.text : null}
          gloss={gloss}
          googleText={googleText}
          translating={translating}
          translateFailed={translateFailed}
          speakFailed={speakFailed}
          speaking={speaking}
          speechReady={speechReady}
          wordSaved={wordSaved}
          deviceError={saved.deviceError}
          googleKey={googleKey.length > 0}
          googleUrl={googleUrl}
          onListen={() => {
            if (selected) speakText(selected.en);
          }}
          onSpeakWord={() => {
            if (selectedWord?.kind === "word") speakText(selectedWord.text, { rate: 0.75 });
          }}
          onClose={dismiss}
          onToggleSave={toggleSave}
          onRetryTranslate={runTranslate}
        />
      ) : null}
      <div className="sr-only" role="status" aria-live="polite">
        {live}
      </div>

      <footer className="flex flex-col items-start gap-3 border-t border-border pt-6" lang={locale}>
        <p className="text-sm text-muted-foreground">{partLabel(locale, partNumber, partTotal)}</p>
        {speechReady && sentences.length > 0 ? (
          <Button type="button" variant="secondary" onClick={readPart}>
            {message(locale, readingPart ? "stopSpeech" : "readPart")}
          </Button>
        ) : null}
        {openedIds.size > 0 || partSavedKeys.length > 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-foreground">
              {partSummaryLabel(locale, openedIds.size, partSavedKeys.length)}
            </p>
            {partSavedKeys.length > 0 ? (
              <Button asChild variant="secondary">
                <Link to="/words" search={{ practice: true, only: partSavedKeys.join(",") }}>
                  {message(locale, "practice")}
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        {next ? (
          <Button asChild size="lg">
            <Link to="/books/$bookId/$chapterId" params={{ bookId, chapterId: next.id }}>
              {nextPartLabel(locale, localized(next.title, locale))}
            </Link>
          </Button>
        ) : (
          <>
            <p className="text-foreground">{message(locale, "bookFinished")}</p>
            <Button asChild>
              <Link to="/">{message(locale, "backToBooks")}</Link>
            </Button>
          </>
        )}
        {previous ? (
          <Button asChild variant="secondary">
            <Link to="/books/$bookId/$chapterId" params={{ bookId, chapterId: previous.id }}>
              {message(locale, "previousChapter")}
            </Link>
          </Button>
        ) : null}
      </footer>
      <Toast
        open={undo !== null}
        onOpenChange={(open) => {
          if (!open) setUndo(null);
        }}
        title={message(locale, "wordSavedStatus")}
        undoLabel={message(locale, "cancelAction")}
        closeLabel={message(locale, "closePanel")}
        onUndo={() => {
          if (undo === null) return;
          const ok = saved.remove(undo.word, nativeLanguage);
          if (ok) setLive(message(locale, "wordRemovedStatus"));
          setUndo(null);
        }}
      />
    </div>
  );
}

type Group = ReturnType<typeof paragraphGroups>[number];

const ParagraphBlock = memo(
  function ParagraphBlock({
    group,
    paragraphIndex,
    activeId,
    wordIndex,
    tabStopId,
    nativeLanguage,
    patches,
    savedWords,
    onSentence,
    onWord,
    keyboardClick,
  }: {
    group: Group;
    paragraphIndex: number;
    activeId: string | null;
    wordIndex: number | null;
    cursorId: string | null;
    tabStopId: string | null;
    nativeLanguage: NativeLanguage;
    patches: Readonly<Record<string, { uk: string; ru: string }>>;
    savedWords: ReadonlySet<string>;
    onSentence: (id: string) => void;
    onWord: (sentenceId: string, wordIndex: number) => void;
    keyboardClick: { current: boolean };
  }) {
    const subhead =
      group.sentences.length === 1 &&
      group.sentences[0] !== undefined &&
      isSubhead(group.sentences[0].sentence.en, 1, paragraphIndex);
    return (
      <div className={subhead ? "reader-paragraph mb-6" : "reader-paragraph mb-5"}>
        <p className="reading-text text-foreground" lang="en">
          {group.sentences.map((item, index) => (
            <Fragment key={item.sentence.id}>
              {index > 0 ? " " : null}
              <SentenceRow
                sentence={item.sentence}
                open={activeId === item.sentence.id}
                wordIndex={activeId === item.sentence.id ? wordIndex : null}
                tabbable={tabStopId === item.sentence.id}
                subhead={subhead}
                savedWords={savedWords}
                onSentence={onSentence}
                onWord={onWord}
                keyboardClick={keyboardClick}
              />
            </Fragment>
          ))}
        </p>
        <p className="reader-translation reading-text text-foreground">
          {group.sentences.map((item, index) => {
            const line = sentenceForLine(item.sentence, patches);
            const shown = shownTranslation(line, nativeLanguage);
            if (!shown) return null;
            const open = activeId === item.sentence.id;
            return (
              <Fragment key={item.sentence.id}>
                {index > 0 ? " " : null}
                <span lang={shown.lang} className={open ? "sentence-selected" : "sentence-unit"}>
                  {shown.text}
                </span>
              </Fragment>
            );
          })}
        </p>
      </div>
    );
  },
  (previous, next) => {
    if (previous.savedWords !== next.savedWords) return false;
    if (previous.group !== next.group) return false;
    if (previous.nativeLanguage !== next.nativeLanguage) return false;
    if (previous.patches !== next.patches) return false;
    if (previous.paragraphIndex !== next.paragraphIndex) return false;
    const touches = (id: string | null) =>
      id !== null && previous.group.sentences.some((item) => item.sentence.id === id);
    const involved = [previous.activeId, previous.cursorId, previous.tabStopId, next.activeId, next.cursorId, next.tabStopId];
    if (!involved.some((id) => touches(id))) return true;
    return (
      previous.activeId === next.activeId &&
      previous.wordIndex === next.wordIndex &&
      previous.cursorId === next.cursorId &&
      previous.tabStopId === next.tabStopId
    );
  },
);

const SentenceRow = memo(
  function SentenceRow({
    sentence,
    open,
    wordIndex,
    tabbable,
    subhead,
    savedWords,
    onSentence,
    onWord,
    keyboardClick,
  }: {
    sentence: ReaderSentence;
    open: boolean;
    wordIndex: number | null;
    tabbable: boolean;
    subhead: boolean;
    savedWords: ReadonlySet<string>;
    onSentence: (id: string) => void;
    onWord: (sentenceId: string, wordIndex: number) => void;
    keyboardClick: { current: boolean };
  }) {
    const tokens = tokensFor(sentence.id, sentence.en);
    const content: ReactNode[] = tokens.map((token, tokenIndex) => {
      if (token.kind === "gap") return createElement(Fragment, { key: `g${tokenIndex}` }, token.text);
      const marked = open && wordIndex === token.index;
      const savedMark = savedWords.has(normalizeWord(token.text));
      const className = [marked ? "word-selected" : "", savedMark ? "word-saved" : ""]
        .filter((item) => item !== "")
        .join(" ");
      return createElement(
        "span",
        {
          key: `w${token.index}`,
          "data-word-index": String(token.index),
          className: className === "" ? undefined : className,
          "aria-current": marked ? "true" : undefined,
        },
        token.text,
      );
    });
    return createElement(
      "span",
      {
        role: "button",
        tabIndex: tabbable ? 0 : -1,
        "data-sentence-id": sentence.id,
        "aria-expanded": open,
        "aria-current": open ? "true" : undefined,
        "aria-controls": open ? "study-panel" : undefined,
        lang: "en",
        className: open
          ? `sentence-unit sentence-selected${subhead ? " sentence-subhead" : ""}`
          : `sentence-unit sentence-hover${subhead ? " sentence-subhead" : ""}`,
        onClick: (event: React.MouseEvent<HTMLSpanElement>) => {
          if (keyboardClick.current) {
            keyboardClick.current = false;
            return;
          }
          if (!collapsedSelection()) return;
          const index = wordIndexFromTarget(event.target);
          if (open && index !== null) onWord(sentence.id, index);
          else onSentence(sentence.id);
        },
      },
      content,
    );
  },
  (previous, next) =>
    previous.sentence === next.sentence &&
    previous.open === next.open &&
    previous.wordIndex === next.wordIndex &&
    previous.tabbable === next.tabbable &&
    previous.subhead === next.subhead &&
    previous.savedWords === next.savedWords,
);

function OwnedTextControls({
  bookId,
  title,
  locale,
  onRenamed,
  onDeleted,
}: {
  bookId: string;
  title: string;
  locale: Locale;
  onRenamed: () => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState<"rename" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    const next = draft.trim();
    if (next.length < 1 || next.length > maxTitleLength) {
      setError(message(locale, "invalidInput"));
      return;
    }
    setBusy("rename");
    setError(null);
    try {
      const result = await renameMyBook({ data: { bookId, title: next } });
      if (!result.ok) {
        setError(message(locale, result.error === "invalid" ? "invalidInput" : "actionFailed"));
        return;
      }
      setMode("idle");
      onRenamed();
    } catch {
      setError(message(locale, "actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    try {
      const result = await deleteMyBook({ data: { bookId } });
      if (!result.ok) {
        setError(message(locale, "actionFailed"));
        return;
      }
      onDeleted();
    } catch {
      setError(message(locale, "actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {mode === "rename" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <Field id={`reader-rename-${bookId}`} label={message(locale, "renameBook")}>
            <Input
              value={draft}
              maxLength={maxTitleLength}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <Button type="submit" busy={busy === "rename"}>
            {message(locale, "renameBook")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setMode("idle")}>
            {message(locale, "cancelAction")}
          </Button>
        </form>
      ) : mode === "delete" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-foreground">{title}</p>
          <Button type="button" variant="danger" autoFocus busy={busy === "delete"} onClick={() => void remove()}>
            {message(locale, "confirmDeletePermanent")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setMode("idle")}>
            {message(locale, "cancelAction")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraft(title);
              setMode("rename");
            }}
          >
            {message(locale, "renameBook")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setMode("delete")}>
            {message(locale, "deleteText")}
          </Button>
        </div>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
