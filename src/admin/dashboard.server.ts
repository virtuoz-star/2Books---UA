import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";

import { adminActionAllowed } from "#/auth/admins";
import { getAuth } from "#/auth/auth.server";
import { database } from "#/auth/db.server";
import { readCurrentUser } from "#/auth/session.server";
import type { CurrentUser } from "#/auth/session";
import { catalogBooks, getCatalogBook, type Book } from "#/content/catalog";
import type { Locale } from "#/i18n/types";
import { prepareCatalogBook, type PreparedCatalogBook } from "#/library/catalog-draft";
import { parseTwoBooks } from "#/library/two-books";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  nativeLanguage: "uk" | "ru";
  banned: boolean;
  createdAt: string;
};

export type AdminCatalogBook = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  chapterCount: number;
  sentenceCount: number;
  stored: boolean;
};

export type AdminUpload = {
  id: string;
  title: string;
  ownerEmail: string;
  alignment: "pending" | "ready";
  sentenceCount: number;
  createdAt: string;
};

export type AdminDashboard = {
  actorId: string;
  users: AdminUserRow[];
  catalog: AdminCatalogBook[];
  uploads: AdminUpload[];
};

export type AdminFailure =
  | "forbidden"
  | "last-admin"
  | "not-found"
  | "unavailable"
  | "invalid-input"
  | "reserved-id"
  | "duplicate";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string | null;
  banned: number | null;
  nativeLanguage: string | null;
  createdAt: string | number;
};

type UploadRow = {
  id: string;
  title: string;
  alignment: string;
  created_at: number;
  body_json: string;
  email: string | null;
};

function roleOf(value: string | null): "admin" | "user" {
  return value === "admin" ? "admin" : "user";
}

function nativeOf(value: string | null): "uk" | "ru" {
  return value === "ru" ? "ru" : "uk";
}

function createdAtOf(value: string | number): string {
  if (typeof value === "number") return new Date(value).toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function sentenceCount(body: string): number {
  try {
    const parsed = JSON.parse(body) as { chapters?: { sentences?: unknown[] }[] };
    if (!Array.isArray(parsed.chapters)) return 0;
    return parsed.chapters.reduce((sum, chapter) => {
      return sum + (Array.isArray(chapter?.sentences) ? chapter.sentences.length : 0);
    }, 0);
  } catch {
    return 0;
  }
}

function adminCatalogEntry(book: Book, stored: boolean, sentenceTotal?: number): AdminCatalogBook {
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
    sentenceCount:
      sentenceTotal ?? book.chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0),
    stored,
  };
}

async function actor(): Promise<CurrentUser | null> {
  try {
    const user = await readCurrentUser();
    if (!user || user.role !== "admin") return null;
    return user;
  } catch {
    return null;
  }
}

async function adminCount(): Promise<number> {
  const row = await database()
    .prepare(
      `SELECT COUNT(*) AS count FROM "user"
       WHERE role = 'admin' AND (banned IS NULL OR banned = 0)`,
    )
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function targetRole(userId: string): Promise<"admin" | "user" | null> {
  const row = await database()
    .prepare('SELECT role FROM "user" WHERE id = ?')
    .bind(userId)
    .first<{ role: string | null }>();
  if (!row) return null;
  return roleOf(row.role);
}

export async function loadDashboard(): Promise<AdminDashboard | { error: "forbidden" }> {
  const user = await actor();
  if (!user) return { error: "forbidden" };
  const db = database();
  const { listAdminCatalogBooks } = await import("#/library/books.server");
  const [users, uploads, storedBooks] = await Promise.all([
    db
      .prepare(
        `SELECT id, email, name, role, banned, "nativeLanguage" AS nativeLanguage, "createdAt" AS createdAt
         FROM "user"
         ORDER BY "createdAt" DESC, email ASC
         LIMIT 200`,
      )
      .all<UserRow>(),
    db
      .prepare(
        `SELECT user_books.id AS id, user_books.title AS title, user_books.alignment AS alignment,
                user_books.created_at AS created_at, user_books.body_json AS body_json, "user".email AS email
         FROM user_books
         LEFT JOIN "user" ON "user".id = user_books.user_id
         ORDER BY user_books.created_at DESC, user_books.id DESC`,
      )
      .all<UploadRow>(),
    listAdminCatalogBooks(),
  ]);
  return {
    actorId: user.id,
    users: users.results.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: roleOf(row.role),
      nativeLanguage: nativeOf(row.nativeLanguage),
      banned: row.banned === 1,
      createdAt: createdAtOf(row.createdAt),
    })),
    catalog: [
      ...catalogBooks.map((book) => adminCatalogEntry(book, false)),
      ...storedBooks.map((item) => adminCatalogEntry(item.book, true, item.sentenceTotal)),
    ],
    uploads: uploads.results.map((row) => ({
      id: row.id,
      title: row.title,
      ownerEmail: row.email ?? "",
      alignment: row.alignment === "ready" ? "ready" : "pending",
      sentenceCount: sentenceCount(row.body_json),
      createdAt: createdAtOf(row.created_at),
    })),
  };
}

async function guard(
  targetId: string,
  action: "set-role" | "ban" | "unban" | "delete" | "language",
  nextRole?: "admin" | "user",
): Promise<{ ok: true; actor: CurrentUser } | { ok: false; error: AdminFailure }> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  const role = await targetRole(targetId);
  if (role === null) return { ok: false, error: "not-found" };
  const allowed = adminActionAllowed({
    actorId: user.id,
    targetId,
    targetRole: role,
    adminCount: await adminCount(),
    action,
    nextRole,
  });
  if (!allowed) return { ok: false, error: "last-admin" };
  return { ok: true, actor: user };
}

export async function setUserRole(
  userId: string,
  role: "admin" | "user",
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const check = await guard(userId, "set-role", role);
  if (!check.ok) return check;
  try {
    const auth = getAuth(getRequest());
    await auth.api.setRole({
      headers: getRequestHeaders(),
      body: { userId, role },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function setUserLanguage(
  userId: string,
  nativeLanguage: "uk" | "ru",
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const check = await guard(userId, "language");
  if (!check.ok) return check;
  try {
    await database()
      .prepare('UPDATE "user" SET "nativeLanguage" = ? WHERE id = ?')
      .bind(nativeLanguage, userId)
      .run();
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function setUserBanned(
  userId: string,
  banned: boolean,
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const check = await guard(userId, banned ? "ban" : "unban");
  if (!check.ok) return check;
  try {
    const auth = getAuth(getRequest());
    const headers = getRequestHeaders();
    if (banned) {
      await auth.api.banUser({ headers, body: { userId } });
    } else {
      await auth.api.unbanUser({ headers, body: { userId } });
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function deleteUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const check = await guard(userId, "delete");
  if (!check.ok) return check;
  try {
    const auth = getAuth(getRequest());
    await auth.api.removeUser({
      headers: getRequestHeaders(),
      body: { userId },
    });
    const db = database();
    await db.batch([
      db.prepare("DELETE FROM progress WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM user_books WHERE user_id = ?").bind(userId),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function deleteUpload(
  bookId: string,
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  if (getCatalogBook(bookId)) return { ok: false, error: "not-found" };
  try {
    const db = database();
    const owned = await db
      .prepare("SELECT id FROM user_books WHERE id = ?")
      .bind(bookId)
      .first<{ id: string }>();
    if (!owned) return { ok: false, error: "not-found" };
    await db.batch([
      db.prepare("DELETE FROM progress WHERE book_id = ?").bind(bookId),
      db.prepare("DELETE FROM user_books WHERE id = ?").bind(bookId),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function createCatalogBook(
  input: PreparedCatalogBook,
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  const prepared = prepareCatalogBook(input);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  try {
    const { insertCatalogBook } = await import("#/library/books.server");
    const outcome = await insertCatalogBook(prepared.book);
    if (outcome === "duplicate") return { ok: false, error: "duplicate" };
    if (outcome === "reserved") return { ok: false, error: "reserved-id" };
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function importCatalogFile(
  fileBase64: string,
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  let bytes: Uint8Array;
  try {
    const binary = atob(fileBase64);
    bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  } catch {
    return { ok: false, error: "invalid-input" };
  }
  try {
    const parsed = await parseTwoBooks(bytes);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const { insertImportedCatalogBook } = await import("#/library/books.server");
    const outcome = await insertImportedCatalogBook(parsed.book);
    if (outcome === "duplicate") return { ok: false, error: "duplicate" };
    if (outcome === "reserved") return { ok: false, error: "reserved-id" };
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function deleteCatalogBook(
  bookId: string,
): Promise<{ ok: true } | { ok: false; error: AdminFailure }> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  if (getCatalogBook(bookId)) return { ok: false, error: "not-found" };
  try {
    const { deleteStoredCatalogBook } = await import("#/library/books.server");
    const outcome = await deleteStoredCatalogBook(bookId);
    if (outcome === "missing") return { ok: false, error: "not-found" };
    return { ok: true };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
