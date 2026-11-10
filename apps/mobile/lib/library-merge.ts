import type { BookSummary } from "@/lib/types";

export type LibraryRow =
  | { source: "catalog"; key: `catalog:${string}`; book: BookSummary }
  | { source: "local"; key: `local:${string}`; book: BookSummary };

const catalogToLocal: Record<string, string> = {
  "gift-of-the-magi": "gift-of-the-magi-reader",
};

/** A catalog download is stored under this id. Unknown ids stay as themselves. */
export function localIdForCatalog(catalogId: string): string {
  return catalogToLocal[catalogId] ?? catalogId;
}

/** The catalog id for a phone copy. Unknown ids stay as themselves. */
export function catalogIdForLocal(localId: string): string {
  for (const [catalogId, mapped] of Object.entries(catalogToLocal)) {
    if (mapped === localId) return catalogId;
  }
  return localId;
}

/** Catalog and on-phone ids that name one book, including the gift pair. */
export function bookIdAliases(bookId: string): string[] {
  return [...new Set([bookId, localIdForCatalog(bookId), catalogIdForLocal(bookId)])];
}

export function sameBookId(left: string, right: string): boolean {
  return bookIdAliases(left).includes(right);
}

/** Row progress. The row's own mark wins; the gift pair is the fallback. */
export function markForBook<T>(marks: Record<string, T>, bookId: string): T | undefined {
  return (
    marks[bookId] ??
    marks[catalogIdForLocal(bookId)] ??
    marks[localIdForCatalog(bookId)]
  );
}

export function mergeLibrary(
  catalog: BookSummary[] | null,
  local: BookSummary[],
): { rows: LibraryRow[]; catalog: "ready" | "missing" } {
  const localRows = local.map((book) => ({
    source: "local" as const,
    key: `local:${book.id}` as const,
    book,
  }));
  if (catalog === null) return { rows: localRows, catalog: "missing" };
  const onPhone = new Set(local.map((book) => book.id));
  const catalogRows = catalog
    .filter((book) => !onPhone.has(book.id) && !onPhone.has(localIdForCatalog(book.id)))
    .map((book) => ({
      source: "catalog" as const,
      key: `catalog:${book.id}` as const,
      book,
    }));
  return {
    catalog: "ready",
    rows: [...localRows, ...catalogRows],
  };
}
