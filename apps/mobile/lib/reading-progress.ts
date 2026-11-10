import { Directory, File, Paths } from "expo-file-system";

export type ReadingMark = {
  bookId: string;
  source: "local" | "catalog";
  chapterId: string;
  chapterIndex: number;
  chapterCount: number;
  sentenceId: string | null;
  sentenceIndex: number;
  ratio: number;
  title: string;
  author: string;
  updatedAt: number;
};

type ReadingFile = {
  last: ReadingMark | null;
  byBook: Record<string, ReadingMark>;
};

const emptyFile: ReadingFile = { last: null, byBook: {} };

let chain: Promise<void> = Promise.resolve();

function withChain<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function markFrom(value: unknown): ReadingMark | null {
  if (!isRecord(value)) return null;
  if (typeof value.bookId !== "string" || value.bookId.length === 0) return null;
  if (value.source !== "local" && value.source !== "catalog") return null;
  if (typeof value.chapterId !== "string" || value.chapterId.length === 0) return null;
  if (typeof value.chapterIndex !== "number" || !Number.isInteger(value.chapterIndex)) return null;
  if (typeof value.chapterCount !== "number" || !Number.isInteger(value.chapterCount)) return null;
  if (value.sentenceId !== null && typeof value.sentenceId !== "string") return null;
  if (typeof value.sentenceIndex !== "number" || !Number.isInteger(value.sentenceIndex)) return null;
  if (typeof value.ratio !== "number" || !Number.isFinite(value.ratio)) return null;
  if (typeof value.title !== "string" || typeof value.author !== "string") return null;
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) return null;
  const ratio = Math.min(1, Math.max(0, value.ratio));
  return {
    bookId: value.bookId,
    source: value.source,
    chapterId: value.chapterId,
    chapterIndex: Math.max(0, value.chapterIndex),
    chapterCount: Math.max(0, value.chapterCount),
    sentenceId: typeof value.sentenceId === "string" && value.sentenceId.length > 0 ? value.sentenceId : null,
    sentenceIndex: Math.max(0, value.sentenceIndex),
    ratio,
    title: value.title,
    author: value.author,
    updatedAt: value.updatedAt,
  };
}

function progressDir(): Directory {
  const dir = new Directory(Paths.document, "2books");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function readFile(): Promise<ReadingFile> {
  try {
    const file = new File(progressDir(), "reading.json");
    if (!file.exists) return emptyFile;
    const parsed: unknown = JSON.parse(await file.text());
    if (!isRecord(parsed)) return emptyFile;
    const byBook: Record<string, ReadingMark> = {};
    if (isRecord(parsed.byBook)) {
      for (const [key, value] of Object.entries(parsed.byBook)) {
        const mark = markFrom(value);
        if (mark) byBook[key] = mark;
      }
    }
    return { last: markFrom(parsed.last), byBook };
  } catch {
    return emptyFile;
  }
}

async function writeFile(next: ReadingFile): Promise<void> {
  const dir = progressDir();
  const tmp = new File(dir, "reading.json.tmp");
  if (tmp.exists) tmp.delete();
  tmp.create({ intermediates: true });
  await tmp.write(JSON.stringify(next));
  await tmp.move(new File(dir, "reading.json"), { overwrite: true });
}

export function rememberReading(mark: ReadingMark): Promise<void> {
  return withChain(async () => {
    const current = await readFile();
    current.byBook[mark.bookId] = mark;
    current.last = mark;
    await writeFile(current);
  });
}

export function loadLastReading(): Promise<ReadingMark | null> {
  return withChain(async () => (await readFile()).last);
}

export function loadBookMark(bookId: string): Promise<ReadingMark | null> {
  return withChain(async () => (await readFile()).byBook[bookId] ?? null);
}

export function loadReadingMarks(): Promise<Record<string, ReadingMark>> {
  return withChain(async () => (await readFile()).byBook);
}

export { readingRatio } from "@/lib/reading-resume";
