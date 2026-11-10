import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";

import { env } from "cloudflare:workers";

import { adminActionAllowed, isListedAdmin } from "#/auth/admins";
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
  /** True when ADMIN_EMAILS forces this address to stay an administrator. */
  listed: boolean;
};

export type AdminCatalogBook = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  chapterCount: number;
  sentenceCount: number;
  stored: boolean;
  /** True while a .2books import has not finished. The row can be deleted. */
  incomplete: boolean;
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
  userTotal: number;
  userNext: string | null;
  catalog: AdminCatalogBook[];
  /** True when the stored-catalog query stopped early. The public list is not cached in that case. */
  catalogTruncated: boolean;
  uploads: AdminUpload[];
  uploadTotal: number;
  uploadNext: string | null;
};

export type AdminFailure =
  | "forbidden"
  | "last-admin"
  | "not-found"
  | "unavailable"
  | "invalid-input"
  | "reserved-id"
  | "duplicate"
  | "listed";

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
  email: string | null;
  sentence_count: number | null;
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

function adminCatalogEntry(
  book: Book,
  stored: boolean,
  sentenceTotal?: number,
  incomplete = false,
): AdminCatalogBook {
  return {
    id: book.id,
    author: book.author,
    title: book.title,
    chapterCount: book.chapters.length,
    sentenceCount:
      sentenceTotal ?? book.chapters.reduce((sum, chapter) => sum + chapter.sentences.length, 0),
    stored,
    incomplete,
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

const adminPageSize = 50;

type PageCursor = { createdAt: string | number; id: string };

function encodeCursor(createdAt: string | number, id: string): string {
  return JSON.stringify([createdAt, id]);
}

function decodeCursor(value: string): PageCursor | null {
  if (value === "") return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [createdAt, id] = parsed;
    if (typeof id !== "string" || id.length < 1 || id.length > 80) return null;
    if (typeof createdAt === "number") {
      if (!Number.isFinite(createdAt)) return null;
      return { createdAt, id };
    }
    if (typeof createdAt !== "string" || createdAt.length < 1 || createdAt.length > 80) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function likeNeedle(query: string): string {
  return `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

function mapUser(row: UserRow): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: roleOf(row.role),
    nativeLanguage: nativeOf(row.nativeLanguage),
    banned: row.banned === 1,
    createdAt: createdAtOf(row.createdAt),
    listed: isListedAdmin(row.email, env.ADMIN_EMAILS),
  };
}

const userColumns = `id, email, name, role, banned, "nativeLanguage" AS nativeLanguage, "createdAt" AS createdAt`;

async function listAdminUsers(
  query: string,
  cursorRaw: string,
): Promise<{ users: AdminUserRow[]; total: number; next: string | null }> {
  const db = database();
  const search = query.trim();
  const where = search === "" ? "1 = 1" : `(email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')`;
  const searchBinds = search === "" ? [] : [likeNeedle(search), likeNeedle(search)];
  const totalStatement = db.prepare(`SELECT COUNT(*) AS count FROM "user" WHERE ${where}`);
  const totalRow = await (searchBinds.length > 0 ? totalStatement.bind(...searchBinds) : totalStatement).first<{
    count: number;
  }>();
  const cursor = decodeCursor(cursorRaw);
  const cursorSql = cursor ? `AND ("createdAt" < ? OR ("createdAt" = ? AND id < ?))` : "";
  const cursorBinds = cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : [];
  const pageStatement = db.prepare(
    `SELECT ${userColumns}
     FROM "user"
     WHERE (role IS NULL OR role <> 'admin') AND ${where} ${cursorSql}
     ORDER BY "createdAt" DESC, id DESC
     LIMIT ${adminPageSize}`,
  );
  const pageBinds = [...searchBinds, ...cursorBinds];
  const page = await (pageBinds.length > 0 ? pageStatement.bind(...pageBinds) : pageStatement).all<UserRow>();
  let admins: UserRow[] = [];
  if (cursor === null) {
    const adminStatement = db.prepare(
      `SELECT ${userColumns}
       FROM "user"
       WHERE role = 'admin' AND ${where}
       ORDER BY "createdAt" DESC, id DESC`,
    );
    const adminRows = await (searchBinds.length > 0 ? adminStatement.bind(...searchBinds) : adminStatement).all<UserRow>();
    admins = adminRows.results;
  }
  const last = page.results[page.results.length - 1];
  return {
    users: [...admins.map(mapUser), ...page.results.map(mapUser)],
    total: Number(totalRow?.count ?? 0),
    next: page.results.length === adminPageSize && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

async function listAdminUploads(
  cursorRaw: string,
): Promise<{ uploads: AdminUpload[]; total: number; next: string | null }> {
  const db = database();
  const totalRow = await db.prepare("SELECT COUNT(*) AS count FROM user_books").first<{ count: number }>();
  const cursor = decodeCursor(cursorRaw);
  const cursorSql = cursor
    ? `WHERE user_books.created_at < ? OR (user_books.created_at = ? AND user_books.id < ?)`
    : "";
  const statement = db.prepare(
    `SELECT user_books.id AS id, user_books.title AS title, user_books.alignment AS alignment,
            user_books.created_at AS created_at, "user".email AS email,
            (
              SELECT COALESCE(SUM(json_array_length(json_extract(chapter.value, '$.sentences'))), 0)
              FROM json_each(user_books.body_json, '$.chapters') AS chapter
            ) AS sentence_count
     FROM user_books
     LEFT JOIN "user" ON "user".id = user_books.user_id
     ${cursorSql}
     ORDER BY user_books.created_at DESC, user_books.id DESC
     LIMIT ${adminPageSize}`,
  );
  const binds = cursor ? [cursor.createdAt, cursor.createdAt, cursor.id] : [];
  const uploads = await (binds.length > 0 ? statement.bind(...binds) : statement).all<UploadRow>();
  const last = uploads.results[uploads.results.length - 1];
  return {
    uploads: uploads.results.map((row) => ({
      id: row.id,
      title: row.title,
      ownerEmail: row.email ?? "",
      alignment: row.alignment === "ready" ? "ready" : "pending",
      sentenceCount: Number(row.sentence_count ?? 0),
      createdAt: createdAtOf(row.created_at),
    })),
    total: Number(totalRow?.count ?? 0),
    next: uploads.results.length === adminPageSize && last ? encodeCursor(last.created_at, last.id) : null,
  };
}

async function targetAccount(
  userId: string,
): Promise<{ role: "admin" | "user"; banned: boolean; email: string } | null> {
  const row = await database()
    .prepare('SELECT role, banned, email FROM "user" WHERE id = ?')
    .bind(userId)
    .first<{ role: string | null; banned: number | null; email: string }>();
  if (!row) return null;
  return { role: roleOf(row.role), banned: row.banned === 1, email: row.email };
}

export async function loadDashboard(query?: {
  userQuery?: string;
  userCursor?: string;
  uploadCursor?: string;
}): Promise<AdminDashboard | { error: "forbidden" }> {
  const user = await actor();
  if (!user) return { error: "forbidden" };
  const { listAdminCatalogBooks } = await import("#/library/books.server");
  const [users, uploads, storedBooks] = await Promise.all([
    listAdminUsers(query?.userQuery ?? "", query?.userCursor ?? ""),
    listAdminUploads(query?.uploadCursor ?? ""),
    listAdminCatalogBooks(),
  ]);
  return {
    actorId: user.id,
    users: users.users,
    userTotal: users.total,
    userNext: users.next,
    catalog: [
      ...storedBooks.books.map((item) =>
        adminCatalogEntry(item.book, true, item.sentenceTotal, item.incomplete === true),
      ),
      ...catalogBooks.map((book) => adminCatalogEntry(book, false)),
    ],
    catalogTruncated: storedBooks.truncated,
    uploads: uploads.uploads,
    uploadTotal: uploads.total,
    uploadNext: uploads.next,
  };
}

async function guard(
  targetId: string,
  action: "set-role" | "ban" | "unban" | "delete" | "language",
  nextRole?: "admin" | "user",
): Promise<{ ok: true; actor: CurrentUser } | { ok: false; error: AdminFailure }> {
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  const account = await targetAccount(targetId);
  if (account === null) return { ok: false, error: "not-found" };
  const allowed = adminActionAllowed({
    actorId: user.id,
    targetId,
    targetRole: account.role,
    targetBanned: account.banned,
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
  const acting = await actor();
  if (!acting) return { ok: false, error: "forbidden" };
  const account = await targetAccount(userId);
  if (account && isListedAdmin(account.email, env.ADMIN_EMAILS)) {
    return { ok: false, error: "listed" };
  }
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
  const user = await actor();
  if (!user) return { ok: false, error: "forbidden" };
  const account = await targetAccount(userId);
  if (account) {
    const allowed = adminActionAllowed({
      actorId: user.id,
      targetId: userId,
      targetRole: account.role,
      targetBanned: account.banned,
      adminCount: await adminCount(),
      action: "delete",
    });
    if (!allowed) return { ok: false, error: "last-admin" };
  }
  try {
    const db = database();
    await db.batch([
      db.prepare("DELETE FROM progress WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM user_books WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM saved_words WHERE user_id = ?").bind(userId),
    ]);
    if (!account) return { ok: true };
    const auth = getAuth(getRequest());
    await auth.api.removeUser({
      headers: getRequestHeaders(),
      body: { userId },
    });
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
