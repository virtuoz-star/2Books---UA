import { Directory, File, FileMode, Paths } from "expo-file-system";

import { parseTwoBooksArchive, type TwoBooksCatalog } from "../../../src/library/two-books-parse";
import {
  archiveDeclaredSizeAllowed,
  beginArchiveInflate,
  endArchiveInflate,
  inflateArchive,
} from "@/lib/inflate-archive";
import { isImportLocked } from "@/lib/import-lock";
import {
  ARCHIVE_LIMIT,
  archiveNameAllowed,
  archiveSizeAllowed,
  resolvedImportName,
  importDeletesSource,
  indexJsonKind,
  isLocalSlug,
  planVersion1Recovery,
  positionAfterReplace,
  resolveLocalSlug,
  type BookJsonSnapshot,
  type IndexBook,
  type LocalPosition,
  type RecoveryAction,
} from "@/lib/local-plan";
import type { BookTitle, Chapter, Sentence } from "@/lib/types";

export type { LocalPosition };

export type StoredLocalBook = {
  version: 1;
  id: string;
  author: string;
  title: BookTitle;
  importedAt: number;
  chapters: {
    id: string;
    title: BookTitle;
    sentenceCount: number;
  }[];
};

export type LocalSummary = IndexBook;

export type ImportResult =
  | { ok: true; id: string }
  | { ok: false; error: "invalid-input" | "reserved-id" | "io" };

export type LoadedLocalBook =
  | { status: "rejected" }
  | { status: "missing" }
  | {
      status: "ready";
      book: StoredLocalBook;
      openIndex: number;
      chapter: Chapter;
      sentenceId: string | null;
    };

type ParsedBookFile = {
  id: string;
  author: string;
  title: BookTitle;
  importedAt?: number;
  chapters: StoredLocalBook["chapters"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function libraryRoot(): Directory {
  return new Directory(Paths.document, "2books", "library");
}

function booksRoot(): Directory {
  return new Directory(libraryRoot(), "books");
}

function ensureDirectory(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

function parseTitle(value: unknown): BookTitle | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.uk !== "string" ||
    typeof value.ru !== "string" ||
    typeof value.en !== "string"
  ) {
    return null;
  }
  return { uk: value.uk, ru: value.ru, en: value.en };
}

function parseChapterMeta(value: unknown): StoredLocalBook["chapters"][number] | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isLocalSlug(value.id)) return null;
  const title = parseTitle(value.title);
  if (title === null) return null;
  if (
    typeof value.sentenceCount !== "number" ||
    !Number.isInteger(value.sentenceCount) ||
    value.sentenceCount < 0
  ) {
    return null;
  }
  return { id: value.id, title, sentenceCount: value.sentenceCount };
}

function parseBookFile(value: unknown): ParsedBookFile | null {
  if (!isRecord(value)) return null;
  if (value.version !== undefined && value.version !== 1) return null;
  if (typeof value.id !== "string" || !isLocalSlug(value.id)) return null;
  if (typeof value.author !== "string") return null;
  const title = parseTitle(value.title);
  if (title === null || !Array.isArray(value.chapters) || value.chapters.length < 1) return null;
  const chapters: StoredLocalBook["chapters"] = [];
  for (const chapter of value.chapters) {
    const parsed = parseChapterMeta(chapter);
    if (parsed === null) return null;
    chapters.push(parsed);
  }
  const importedAt = value.importedAt;
  if (importedAt !== undefined && (typeof importedAt !== "number" || !Number.isFinite(importedAt)))
    return null;
  return {
    id: value.id,
    author: value.author,
    title,
    importedAt: typeof importedAt === "number" ? importedAt : undefined,
    chapters,
  };
}

function parseIndexBook(value: unknown): IndexBook | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isLocalSlug(value.id)) return null;
  if (typeof value.author !== "string") return null;
  const title = parseTitle(value.title);
  if (title === null) return null;
  if (
    typeof value.chapterCount !== "number" ||
    !Number.isInteger(value.chapterCount) ||
    value.chapterCount < 0
  ) {
    return null;
  }
  if (typeof value.importedAt !== "number" || !Number.isFinite(value.importedAt)) return null;
  return {
    id: value.id,
    author: value.author,
    title: { uk: title.uk, ru: title.ru, en: title.en },
    chapterCount: value.chapterCount,
    importedAt: value.importedAt,
  };
}

function parseSentence(value: unknown): Sentence | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) return null;
  if (typeof value.en !== "string" || typeof value.uk !== "string" || typeof value.ru !== "string")
    return null;
  const sentence: Sentence = { id: value.id, en: value.en, uk: value.uk, ru: value.ru };
  if (
    typeof value.paragraph === "number" &&
    Number.isInteger(value.paragraph) &&
    value.paragraph >= 0
  ) {
    sentence.paragraph = value.paragraph;
  }
  return sentence;
}

async function readJson(file: File): Promise<unknown> {
  if (!file.exists) return undefined;
  return JSON.parse(await file.text()) as unknown;
}

async function readBookFile(file: File): Promise<ParsedBookFile | null> {
  try {
    const parsed = await readJson(file);
    if (parsed === undefined) return null;
    return parseBookFile(parsed);
  } catch {
    return null;
  }
}

async function writeTextFile(file: File, contents: string): Promise<void> {
  const tmp = new File(file.parentDirectory, `${file.name}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create({ intermediates: true });
  await tmp.write(contents);
  await tmp.move(file, { overwrite: true });
}

async function readPosition(dir: Directory): Promise<LocalPosition | null> {
  const file = new File(dir, "position.json");
  const tmp = new File(dir, "position.json.tmp");
  if (!file.exists && tmp.exists) {
    try {
      await tmp.move(file, { overwrite: true });
    } catch {
      // Read the tmp below when the move was interrupted.
    }
  }
  try {
    const parsed = await readJson(file.exists ? file : tmp);
    if (!isRecord(parsed) || typeof parsed.chapterId !== "string" || !isLocalSlug(parsed.chapterId))
      return null;
    if (parsed.sentenceId !== null && typeof parsed.sentenceId !== "string") return null;
    const sentenceId =
      typeof parsed.sentenceId === "string" && parsed.sentenceId.length > 0
        ? parsed.sentenceId
        : null;
    return { chapterId: parsed.chapterId, sentenceId };
  } catch {
    return null;
  }
}

function deletePosition(dir: Directory): void {
  const file = new File(dir, "position.json");
  if (file.exists) file.delete();
}

async function readChapter(dir: Directory, chapterId: string): Promise<Chapter | null> {
  if (!isLocalSlug(chapterId)) return null;
  try {
    const parsed = await readJson(new File(dir, "chapters", `${chapterId}.json`));
    if (!isRecord(parsed) || parsed.id !== chapterId) return null;
    const title = parseTitle(parsed.title);
    if (title === null || !Array.isArray(parsed.sentences)) return null;
    const sentences: Sentence[] = [];
    for (const sentence of parsed.sentences) {
      const parsedSentence = parseSentence(sentence);
      if (parsedSentence === null) return null;
      sentences.push(parsedSentence);
    }
    return { id: chapterId, title, sentences };
  } catch {
    return null;
  }
}

type IndexState = { kind: "missing" } | { kind: "foreign" } | { kind: "ready"; books: IndexBook[] };

async function readIndex(): Promise<IndexState> {
  const root = libraryRoot();
  const file = new File(root, "index.json");
  const tmp = new File(root, "index.json.tmp");
  if (!file.exists && tmp.exists) {
    try {
      await tmp.move(file, { overwrite: true });
    } catch {
      // Read the tmp below when the move was interrupted.
    }
  }
  const source = file.exists ? file : tmp;
  if (!source.exists) return { kind: "missing" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await source.text()) as unknown;
  } catch {
    return { kind: "missing" };
  }
  const kind = indexJsonKind(parsed);
  if (kind !== "ready" || !isRecord(parsed)) return { kind: kind === "ready" ? "missing" : kind };
  const books: IndexBook[] = [];
  if (Array.isArray(parsed.books)) {
    for (const entry of parsed.books) {
      const book = parseIndexBook(entry);
      if (book) books.push(book);
    }
  }
  return { kind: "ready", books };
}

async function writeIndex(books: readonly IndexBook[]): Promise<void> {
  const root = libraryRoot();
  ensureDirectory(root);
  const tmp = new File(root, "index.json.tmp");
  await writeTextFile(tmp, JSON.stringify({ version: 1, books }));
  await tmp.move(new File(root, "index.json"), { overwrite: true });
}

function sameIndex(left: readonly IndexBook[], right: readonly IndexBook[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function snapshotOf(book: ParsedBookFile): BookJsonSnapshot {
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    importedAt: book.importedAt,
    chapters: book.chapters.map((chapter) => ({ id: chapter.id })),
  };
}

async function listBookChildren(): Promise<{
  names: string[];
  books: Record<string, BookJsonSnapshot | undefined>;
}> {
  const root = booksRoot();
  if (!root.exists) return { names: [], books: {} };
  const names: string[] = [];
  const books: Record<string, BookJsonSnapshot | undefined> = {};
  for (const child of root.list()) {
    names.push(child.name);
    if (!(child instanceof Directory)) continue;
    const parsed = await readBookFile(new File(child, "book.json"));
    if (parsed) books[child.name] = snapshotOf(parsed);
  }
  return { names, books };
}

async function applyRecovery(actions: readonly RecoveryAction[]): Promise<void> {
  const root = booksRoot();
  ensureDirectory(root);
  for (const action of actions) {
    if (action.type === "delete") {
      const target = new Directory(root, action.name);
      if (target.exists) target.delete();
      continue;
    }
    const from = new Directory(root, action.from);
    if (!from.exists) continue;
    await from.move(new Directory(root, action.to), { overwrite: true });
  }
}

function sortSummaries(books: readonly IndexBook[]): LocalSummary[] {
  return [...books].sort((left, right) => right.importedAt - left.importedAt);
}

function summariesFromLive(
  index: IndexState,
  listed: { books: Record<string, BookJsonSnapshot | undefined> },
): LocalSummary[] {
  if (index.kind === "ready") return sortSummaries(index.books);
  const books: IndexBook[] = [];
  for (const [name, snapshot] of Object.entries(listed.books)) {
    if (!snapshot || snapshot.id !== name || !isLocalSlug(name)) continue;
    books.push({
      id: snapshot.id,
      author: snapshot.author,
      title: { uk: snapshot.title.uk, ru: snapshot.title.ru, en: snapshot.title.en },
      chapterCount: snapshot.chapters.length,
      importedAt: snapshot.importedAt ?? 0,
    });
  }
  return sortSummaries(books);
}

export async function loadLocalSummaries(options?: { recover?: boolean }): Promise<LocalSummary[]> {
  const index = await readIndex();
  if (index.kind === "foreign") return [];
  const listed = await listBookChildren();
  if (options?.recover !== true || !isImportLocked()) return summariesFromLive(index, listed);
  const plan = planVersion1Recovery({
    children: listed.names,
    index: index.kind === "ready" ? index.books : [],
    books: listed.books,
  });
  await applyRecovery(plan.actions);
  const previous = index.kind === "ready" ? index.books : [];
  if (index.kind === "missing" || plan.actions.length > 0 || !sameIndex(previous, plan.index)) {
    await writeIndex(plan.index);
  }
  return sortSummaries(plan.index);
}

function storedBook(book: ParsedBookFile): StoredLocalBook {
  return {
    version: 1,
    id: book.id,
    author: book.author,
    title: book.title,
    importedAt: book.importedAt ?? 0,
    chapters: book.chapters,
  };
}

export async function loadLocalBook(slug: string): Promise<LoadedLocalBook> {
  if (resolveLocalSlug(slug) === null) return { status: "rejected" };
  const dir = new Directory(booksRoot(), slug);
  if (!dir.exists) return { status: "missing" };
  const parsed = await readBookFile(new File(dir, "book.json"));
  if (parsed === null || parsed.id !== slug) return { status: "missing" };
  const book = storedBook(parsed);
  let openIndex = 0;
  let sentenceId: string | null = null;
  const position = await readPosition(dir);
  if (position) {
    const index = book.chapters.findIndex((chapter) => chapter.id === position.chapterId);
    if (index < 0) deletePosition(dir);
    else {
      openIndex = index;
      sentenceId = position.sentenceId;
    }
  }
  const meta = book.chapters[openIndex];
  if (!meta) return { status: "missing" };
  const chapter = await readChapter(dir, meta.id);
  if (chapter === null) return { status: "missing" };
  if (sentenceId !== null && !chapter.sentences.some((sentence) => sentence.id === sentenceId)) {
    sentenceId = null;
  }
  return { status: "ready", book, openIndex, chapter, sentenceId };
}

export async function readStoredPosition(slug: string): Promise<LocalPosition | null> {
  if (resolveLocalSlug(slug) === null) return null;
  const dir = new Directory(booksRoot(), slug);
  if (!dir.exists) return null;
  return readPosition(dir);
}

/** Chapter ids from book.json. Summaries do not carry them. */
export async function readLocalChapterList(
  slug: string,
): Promise<{ id: string; sentenceCount: number }[] | null> {
  if (resolveLocalSlug(slug) === null) return null;
  const dir = new Directory(booksRoot(), slug);
  if (!dir.exists) return null;
  const parsed = await readBookFile(new File(dir, "book.json"));
  if (parsed === null || parsed.id !== slug) return null;
  return parsed.chapters.map((chapter) => ({
    id: chapter.id,
    sentenceCount: chapter.sentenceCount,
  }));
}

export async function loadLocalChapter(slug: string, chapterId: string): Promise<Chapter | null> {
  if (resolveLocalSlug(slug) === null) return null;
  return readChapter(new Directory(booksRoot(), slug), chapterId);
}

const positionChains = new Map<string, Promise<void>>();

export function writeLocalPosition(slug: string, position: LocalPosition): Promise<void> {
  const previous = positionChains.get(slug) ?? Promise.resolve();
  const run = previous.then(
    () => writePositionBody(slug, position),
    () => writePositionBody(slug, position),
  );
  positionChains.set(
    slug,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

async function writePositionBody(slug: string, position: LocalPosition): Promise<void> {
  if (resolveLocalSlug(slug) === null || !isLocalSlug(position.chapterId)) return;
  const dir = new Directory(booksRoot(), slug);
  if (!dir.exists) return;
  const sentenceId =
    typeof position.sentenceId === "string" && position.sentenceId.length > 0
      ? position.sentenceId
      : null;
  await writeTextFile(
    new File(dir, "position.json"),
    JSON.stringify({ chapterId: position.chapterId, sentenceId }),
  );
}

export async function deleteLocalBook(slug: string): Promise<void> {
  if (resolveLocalSlug(slug) === null) return;
  const index = await readIndex();
  const dir = new Directory(booksRoot(), slug);
  if (dir.exists) dir.delete();
  if (index.kind === "foreign") return;
  const books = index.kind === "ready" ? index.books.filter((book) => book.id !== slug) : [];
  await writeIndex(books);
}

async function deleteOwnedSource(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The cache copy is already gone, or the OS still has it open.
  }
}

async function readArchiveBounded(uri: string): Promise<Uint8Array | "oversize" | "unreadable"> {
  let handle;
  try {
    handle = new File(uri).open(FileMode.ReadOnly);
  } catch {
    return "unreadable";
  }
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    const stop = ARCHIVE_LIMIT + 1;
    while (total < stop) {
      const chunk = await handle.readBytes(Math.min(1024 * 1024, stop - total));
      if (chunk.byteLength === 0) break;
      chunks.push(chunk);
      total += chunk.byteLength;
    }
    if (total > ARCHIVE_LIMIT) return "oversize";
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch {
    return "unreadable";
  } finally {
    try {
      handle.close();
    } catch {
      // The read already finished or failed. Closing must not replace that result.
    }
  }
}

async function storeBook(book: TwoBooksCatalog): Promise<void> {
  const index = await readIndex();
  if (index.kind === "foreign") throw new Error("index-version");
  const importedAt = Date.now();
  const root = booksRoot();
  ensureDirectory(root);
  const live = new Directory(root, book.id);
  const previousPosition = live.exists ? await readPosition(live) : null;
  const kept = positionAfterReplace(
    previousPosition,
    book.chapters.map((chapter) => ({
      id: chapter.id,
      sentences: chapter.sentences.map((sentence) => ({ id: sentence.id })),
    })),
  );
  const incomingName = `${book.id}.incoming`;
  const previousName = `${book.id}.previous`;
  const incoming = new Directory(root, incomingName);
  if (incoming.exists) incoming.delete();
  incoming.create({ intermediates: true });
  try {
    const chaptersDir = new Directory(incoming, "chapters");
    chaptersDir.create({ intermediates: true });
    for (const chapter of book.chapters) {
      if (!isLocalSlug(chapter.id)) throw new Error("chapter-id");
      await writeTextFile(new File(chaptersDir, `${chapter.id}.json`), JSON.stringify(chapter));
    }
    const stored: StoredLocalBook = {
      version: 1,
      id: book.id,
      author: book.author,
      title: book.title,
      importedAt,
      chapters: book.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        sentenceCount: chapter.sentences.length,
      })),
    };
    await writeTextFile(new File(incoming, "book.json"), JSON.stringify(stored));
    if (kept) {
      await writeTextFile(new File(incoming, "position.json"), JSON.stringify(kept));
    }
    const previous = new Directory(root, previousName);
    if (previous.exists) previous.delete();
    if (new Directory(root, book.id).exists) {
      await new Directory(root, book.id).move(new Directory(root, previousName), {
        overwrite: true,
      });
    }
    await new Directory(root, incomingName).move(new Directory(root, book.id), { overwrite: true });
    const leftover = new Directory(root, previousName);
    if (leftover.exists) leftover.delete();
    const books = (index.kind === "ready" ? index.books : []).filter(
      (entry) => entry.id !== book.id,
    );
    books.push({
      id: book.id,
      author: book.author,
      title: { uk: book.title.uk, ru: book.title.ru, en: book.title.en },
      chapterCount: book.chapters.length,
      importedAt,
    });
    await writeIndex(books);
  } catch (error) {
    const previousNow = new Directory(root, previousName);
    const incomingNow = new Directory(root, incomingName);
    if (!previousNow.exists && incomingNow.exists) incomingNow.delete();
    throw error;
  }
}

export async function importLocalBook(source: {
  uri: string;
  name?: string | null;
  size?: number | null;
  deleteAfter?: boolean;
  onReadSettled?: () => void;
}): Promise<ImportResult> {
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    source.onReadSettled?.();
  };
  try {
    const name = resolvedImportName(source.uri, source.name);
    if (!archiveNameAllowed(name) || !archiveSizeAllowed(source.size ?? null)) {
      console.error("local-import", "invalid-input");
      settle();
      return { ok: false, error: "invalid-input" };
    }
    let read: Uint8Array | "oversize" | "unreadable";
    try {
      read = await readArchiveBounded(source.uri);
    } catch {
      read = "unreadable";
    } finally {
      settle();
    }
    if (typeof read === "string") {
      console.error("local-import", "invalid-input");
      return { ok: false, error: "invalid-input" };
    }
    if (!archiveDeclaredSizeAllowed(read)) {
      console.error("local-import", "invalid-input");
      return { ok: false, error: "invalid-input" };
    }
    beginArchiveInflate();
    let parsed: Awaited<ReturnType<typeof parseTwoBooksArchive>>;
    try {
      parsed = await parseTwoBooksArchive(read, inflateArchive, { allowEmptyAuthor: true });
    } finally {
      endArchiveInflate();
    }
    if (!parsed.ok) {
      console.error("local-import", parsed.error);
      return { ok: false, error: parsed.error };
    }
    if (!isLocalSlug(parsed.book.id)) {
      console.error("local-import", "invalid-input");
      return { ok: false, error: "invalid-input" };
    }
    try {
      await storeBook(parsed.book);
    } catch {
      console.error("local-import", "io");
      return { ok: false, error: "io" };
    }
    return { ok: true, id: parsed.book.id };
  } finally {
    if (importDeletesSource(source.deleteAfter)) await deleteOwnedSource(source.uri);
  }
}
