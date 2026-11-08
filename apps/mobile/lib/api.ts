import type { BookDetail, BookSummary, BookTitle, Chapter, Sentence } from "@/lib/types";

const DEFAULT_API_URL = "http://localhost:3001";

function apiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const base =
    typeof configured === "string" && configured.trim().length > 0
      ? configured.trim()
      : DEFAULT_API_URL;
  return base.replace(/\/+$/, "");
}

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

function parseSentence(value: unknown): Sentence {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid sentence");
  }
  return {
    id: value.id,
    en: parseText(value.en),
    uk: parseText(value.uk),
    ru: parseText(value.ru),
  };
}

function parseChapter(value: unknown): Chapter {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    throw new Error("Invalid chapter");
  }
  if (!Array.isArray(value.sentences)) throw new Error("Invalid chapter");
  const title = typeof value.title === "string" ? value.title : "";
  return {
    id: value.id,
    title,
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

export async function fetchBooks(signal?: AbortSignal): Promise<BookSummary[]> {
  const response = await fetch(`${apiBase()}/api/books`, {
    signal,
    headers: { accept: "application/json" },
  });
  const body = await readJson(response);
  if (!Array.isArray(body)) throw new Error("Invalid book list");
  return body.map(parseSummary);
}

export async function fetchBook(id: string, signal?: AbortSignal): Promise<BookDetail> {
  const response = await fetch(`${apiBase()}/api/books/${encodeURIComponent(id)}`, {
    signal,
    headers: { accept: "application/json" },
  });
  return parseBook(await readJson(response));
}
