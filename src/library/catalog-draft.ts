const reservedCatalogId = "gift-of-the-magi";
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const maxBodyLength = 900_000;

export const catalogLimits = {
  maxIdLength: 80,
  maxTitleLength: 200,
  maxSentenceLength: 4000,
  maxChapters: 20,
  maxSentences: 500,
} as const;

export type CatalogDraftError = "invalid-input" | "reserved-id";

export type PreparedCatalogBook = {
  id: string;
  author: string;
  title: { uk: string; ru: string; en: string };
  chapters: {
    id: string;
    title: { uk: string; ru: string; en: string };
    sentences: { id: string; en: string; uk: string; ru: string }[];
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return null;
  return trimmed;
}

function cleanTitle(value: unknown): { uk: string; ru: string; en: string } | null {
  if (!isRecord(value)) return null;
  const uk = cleanText(value.uk, catalogLimits.maxTitleLength);
  const ru = cleanText(value.ru, catalogLimits.maxTitleLength);
  const en = cleanText(value.en, catalogLimits.maxTitleLength);
  if (uk === null || ru === null || en === null) return null;
  return { uk, ru, en };
}

function chapterLines(value: string): string[] | null {
  if (typeof value !== "string") return null;
  const normalized = value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (normalized.length === 0) return null;
  const lines = normalized.split("\n").map((line) => line.trim());
  if (lines.some((line) => line.length === 0 || line.length > catalogLimits.maxSentenceLength)) {
    return null;
  }
  return lines;
}

export function alignedSentenceLines(
  en: string,
  uk: string,
  ru: string,
):
  | { ok: true; sentences: { en: string; uk: string; ru: string }[] }
  | { ok: false; error: "invalid-input" } {
  const english = chapterLines(en);
  const ukrainian = chapterLines(uk);
  const russian = chapterLines(ru);
  if (english === null || ukrainian === null || russian === null) {
    return { ok: false, error: "invalid-input" };
  }
  if (english.length !== ukrainian.length || english.length !== russian.length) {
    return { ok: false, error: "invalid-input" };
  }
  return {
    ok: true,
    sentences: english.map((line, index) => ({
      en: line,
      uk: ukrainian[index] ?? "",
      ru: russian[index] ?? "",
    })),
  };
}

export function prepareCatalogBook(
  input: unknown,
): { ok: true; book: PreparedCatalogBook } | { ok: false; error: CatalogDraftError } {
  if (!isRecord(input) || typeof input.id !== "string") {
    return { ok: false, error: "invalid-input" };
  }
  const id = input.id.trim();
  if (id === reservedCatalogId) return { ok: false, error: "reserved-id" };
  if (id.length > catalogLimits.maxIdLength || !idPattern.test(id)) {
    return { ok: false, error: "invalid-input" };
  }
  const author = cleanText(input.author, catalogLimits.maxTitleLength);
  const title = cleanTitle(input.title);
  if (author === null || title === null || !Array.isArray(input.chapters)) {
    return { ok: false, error: "invalid-input" };
  }
  if (input.chapters.length < 1 || input.chapters.length > catalogLimits.maxChapters) {
    return { ok: false, error: "invalid-input" };
  }

  let sentenceNumber = 0;
  const chapters: PreparedCatalogBook["chapters"] = [];
  for (let index = 0; index < input.chapters.length; index += 1) {
    const chapter = input.chapters[index];
    if (!isRecord(chapter) || !Array.isArray(chapter.sentences)) {
      return { ok: false, error: "invalid-input" };
    }
    const chapterTitle = cleanTitle(chapter.title);
    if (chapterTitle === null || chapter.sentences.length < 1) {
      return { ok: false, error: "invalid-input" };
    }
    const sentences: PreparedCatalogBook["chapters"][number]["sentences"] = [];
    for (const sentence of chapter.sentences) {
      sentenceNumber += 1;
      if (sentenceNumber > catalogLimits.maxSentences) {
        return { ok: false, error: "invalid-input" };
      }
      if (!isRecord(sentence)) return { ok: false, error: "invalid-input" };
      const en = cleanText(sentence.en, catalogLimits.maxSentenceLength);
      const uk = cleanText(sentence.uk, catalogLimits.maxSentenceLength);
      const ru = cleanText(sentence.ru, catalogLimits.maxSentenceLength);
      if (en === null || uk === null || ru === null) {
        return { ok: false, error: "invalid-input" };
      }
      sentences.push({ id: `s${sentenceNumber}`, en, uk, ru });
    }
    chapters.push({ id: `c${index + 1}`, title: chapterTitle, sentences });
  }

  if (sentenceNumber < 1) return { ok: false, error: "invalid-input" };
  const book: PreparedCatalogBook = { id, author, title, chapters };
  if (JSON.stringify(book).length > maxBodyLength) {
    return { ok: false, error: "invalid-input" };
  }
  return { ok: true, book };
}
