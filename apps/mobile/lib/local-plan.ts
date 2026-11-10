export const ARCHIVE_LIMIT = 25_000_000;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isLocalSlug(value: string): boolean {
  return value.length <= 80 && slugPattern.test(value);
}

/** Null means the route param must not be joined onto Paths.document. */
export function resolveLocalSlug(slug: string): string | null {
  if (!isLocalSlug(slug)) return null;
  return slug;
}

export type LocalLoadStatus = "rejected" | "missing" | "ready";

export function localLoadStatus(slug: string, bookOnDisk: boolean): LocalLoadStatus {
  if (resolveLocalSlug(slug) === null) return "rejected";
  if (!bookOnDisk) return "missing";
  return "ready";
}

export type LocalPosition = { chapterId: string; sentenceId: string | null };

export function positionAfterReplace(
  previous: LocalPosition | null,
  chapters: readonly { id: string; sentences: readonly { id: string }[] }[],
): LocalPosition | null {
  const sentenceId = previous?.sentenceId;
  if (typeof sentenceId !== "string" || sentenceId.length === 0) return null;
  for (const chapter of chapters) {
    if (chapter.sentences.some((sentence) => sentence.id === sentenceId)) {
      return { chapterId: chapter.id, sentenceId };
    }
  }
  return null;
}

/**
 * A content: URI tail is an opaque provider id, not a file name.
 * Only file: URIs may supply a name when the caller did not.
 */
export function resolvedImportName(uri: string, name?: string | null): string | null {
  if (typeof name === "string" && name.trim().length > 0) return name;
  let protocol = "";
  try {
    protocol = new URL(uri).protocol;
  } catch {
    return null;
  }
  if (protocol !== "file:") return null;
  try {
    const leaf = decodeURIComponent(new URL(uri).pathname.split("/").pop() ?? "");
    return leaf.length > 0 ? leaf : null;
  } catch {
    return null;
  }
}

export function archiveNameAllowed(name: string | null | undefined): boolean {
  if (name == null) return true;
  const leaf = name.split(/[/\\]/).pop() ?? name;
  if (leaf.trim().length === 0) return true;
  if (leaf.toLowerCase().endsWith(".2books")) return true;
  if (!leaf.includes(".")) return true;
  return false;
}

export function archiveSizeAllowed(size: number | null | undefined): boolean {
  if (typeof size !== "number" || !Number.isFinite(size)) return true;
  return size <= ARCHIVE_LIMIT;
}

export type PlanTitle = { uk: string; ru: string; en: string };

export type IndexBook = {
  id: string;
  author: string;
  title: PlanTitle;
  chapterCount: number;
  importedAt: number;
};

export type BookJsonSnapshot = {
  id: string;
  author: string;
  title: PlanTitle;
  importedAt?: number;
  chapters: readonly { id: string }[];
};

export type RecoveryAction =
  | { type: "move"; from: string; to: string; overwrite: true }
  | { type: "delete"; name: string };

function candidateSlug(name: string): string | null {
  let stem = name;
  if (stem.endsWith(".incoming")) stem = stem.slice(0, -".incoming".length);
  else if (stem.endsWith(".previous")) stem = stem.slice(0, -".previous".length);
  if (!isLocalSlug(stem)) return null;
  return stem;
}

function indexBook(
  id: string,
  author: string,
  title: PlanTitle,
  chapterCount: number,
  importedAt: number,
): IndexBook {
  return {
    id,
    author,
    title: { uk: title.uk, ru: title.ru, en: title.en },
    chapterCount,
    importedAt,
  };
}

export function planVersion1Recovery(input: {
  children: readonly string[];
  index: readonly IndexBook[];
  books: Readonly<Record<string, BookJsonSnapshot | undefined>>;
}): { actions: RecoveryAction[]; index: IndexBook[] } {
  const names = new Set(input.children);
  const books = new Map<string, BookJsonSnapshot>();
  for (const [name, snapshot] of Object.entries(input.books)) {
    if (snapshot) books.set(name, snapshot);
  }

  const slugs: string[] = [];
  const seen = new Set<string>();
  for (const child of input.children) {
    const slug = candidateSlug(child);
    if (slug === null || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }

  const actions: RecoveryAction[] = [];
  for (const slug of slugs) {
    const incomingName = `${slug}.incoming`;
    const previousName = `${slug}.previous`;
    const hasIncoming = names.has(incomingName);
    const hasLive = names.has(slug);
    const hasPrevious = names.has(previousName);
    if (hasIncoming && !hasLive && hasPrevious) {
      actions.push({ type: "move", from: previousName, to: slug, overwrite: true });
      const snapshot = books.get(previousName);
      books.delete(previousName);
      names.delete(previousName);
      names.add(slug);
      if (snapshot) books.set(slug, snapshot);
      else books.delete(slug);
      actions.push({ type: "delete", name: incomingName });
      names.delete(incomingName);
      books.delete(incomingName);
      continue;
    }
    if (hasIncoming && !hasLive && !hasPrevious) {
      actions.push({ type: "delete", name: incomingName });
      names.delete(incomingName);
      books.delete(incomingName);
      continue;
    }
    if (hasLive && hasIncoming) {
      actions.push({ type: "delete", name: incomingName });
      names.delete(incomingName);
      books.delete(incomingName);
      if (hasPrevious) {
        actions.push({ type: "delete", name: previousName });
        names.delete(previousName);
        books.delete(previousName);
      }
      continue;
    }
    if (hasLive && hasPrevious) {
      actions.push({ type: "delete", name: previousName });
      names.delete(previousName);
      books.delete(previousName);
    }
  }

  const next = input.index.map((book) =>
    indexBook(book.id, book.author, book.title, book.chapterCount, book.importedAt),
  );
  const indexOf = new Map(next.map((book, index) => [book.id, index]));
  for (const slug of slugs) {
    const file = books.get(slug);
    if (!file || file.id !== slug || !isLocalSlug(file.id)) continue;
    const existingIndex = indexOf.get(file.id);
    const importedAt =
      typeof file.importedAt === "number"
        ? file.importedAt
        : existingIndex === undefined
          ? 0
          : (next[existingIndex]?.importedAt ?? 0);
    const entry = indexBook(file.id, file.author, file.title, file.chapters.length, importedAt);
    if (existingIndex === undefined) {
      indexOf.set(file.id, next.length);
      next.push(entry);
    } else {
      next[existingIndex] = entry;
    }
  }

  const kept = next.filter((book) => {
    const file = books.get(book.id);
    return file !== undefined && file.id === book.id;
  });
  return { actions, index: kept };
}

/** Valid JSON with a version other than 1 stays foreign. Anything unreadable is missing. */
export function indexJsonKind(value: unknown): "missing" | "foreign" | "ready" {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "missing";
  if (!("version" in value)) return "missing";
  if (value.version !== 1) return "foreign";
  return "ready";
}

export function importDeletesSource(deleteAfter: boolean | undefined): boolean {
  return deleteAfter === true;
}

export function shouldWriteParsedJson(disk: unknown, next: unknown): boolean {
  return JSON.stringify(disk) !== JSON.stringify(next);
}

function normalizedHref(uri: string): string | null {
  try {
    return new URL(uri).href;
  } catch {
    return null;
  }
}

function hrefInside(href: string, rootHref: string | null): boolean {
  if (rootHref === null || rootHref.length === 0) return false;
  const root = normalizedHref(rootHref) ?? rootHref;
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return href === prefix.slice(0, -1) || href.startsWith(prefix);
}

/**
 * Android share senders use content: URIs. file: is refused there.
 * On iOS, file: is kept except for paths inside the app document or cache trees,
 * including paths that only land there after ".." is normalized.
 */
export function sharedUriAllowed(
  uri: string,
  platform: string,
  roots: { documentHref: string | null; cacheHref: string | null },
): boolean {
  const href = normalizedHref(uri);
  if (href === null) return false;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol === "content:") return true;
  if (url.protocol !== "file:") return false;
  if (platform === "android") return false;
  if (hrefInside(href, roots.documentHref) || hrefInside(href, roots.cacheHref)) return false;
  return true;
}

export function sameIntentUrl(left: string, right: string): boolean {
  if (left === right) return true;
  const leftHref = normalizedHref(left);
  const rightHref = normalizedHref(right);
  return leftHref !== null && leftHref === rightHref;
}

/** Skip a relaunched initial VIEW intent that this install already handled. */
export function shouldSkipInitialIntent(
  initial: boolean,
  path: string,
  handled: { url: string; at: number } | null,
): boolean {
  if (initial !== true || handled === null || !Number.isFinite(handled.at)) return false;
  return sameIntentUrl(path, handled.url);
}
