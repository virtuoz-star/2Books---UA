import { getCookie, setCookie } from "@tanstack/react-start/server";

import { database } from "#/auth/db.server";
import { hashPassword, verifyPassword } from "#/auth/password";

type CurrentUser = { id: string; email: string; nativeLanguage: "uk" | "ru" };

type AuthResult =
  | { ok: true }
  | { ok: false; error: "invalid-input" | "email-taken" | "invalid-credentials" | "unavailable" };

const sessionCookie = "2books_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: sessionMaxAgeSeconds,
} as const;

let placeholderHash: Promise<string> | null = null;

function placeholderPasswordHash(): Promise<string> {
  placeholderHash ??= hashPassword("placeholder-password");
  return placeholderHash;
}

function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function writeSessionCookie(sessionId: string): void {
  setCookie(sessionCookie, sessionId, sessionCookieOptions);
}

function clearSessionCookie(): void {
  setCookie(sessionCookie, "", { ...sessionCookieOptions, maxAge: 0 });
}

function readSessionId(): string | null {
  const value = getCookie(sessionCookie);
  if (value === undefined || !/^[0-9a-f]{64}$/.test(value)) return null;
  return value;
}

function nativeLanguageOf(value: string): CurrentUser["nativeLanguage"] {
  return value === "ru" ? "ru" : "uk";
}

function isEmailTaken(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE");
}

type UserSessionRow = {
  id: string;
  email: string;
  native_language: string;
  expires_at: number;
};

export async function readCurrentUser(): Promise<CurrentUser | null> {
  const sessionId = readSessionId();
  if (sessionId === null) return null;
  const row = await database()
    .prepare(
      `SELECT users.id AS id, users.email AS email, users.native_language AS native_language,
              sessions.expires_at AS expires_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`,
    )
    .bind(sessionId)
    .first<UserSessionRow>();
  if (!row) return null;
  if (row.expires_at <= Date.now()) {
    clearSessionCookie();
    try {
      await database().prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    } catch {
      // The cookie is already cleared. An expired row can be removed later.
    }
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    nativeLanguage: nativeLanguageOf(row.native_language),
  };
}

export async function createAccount(input: {
  email: string;
  password: string;
  nativeLanguage: "uk" | "ru";
}): Promise<AuthResult> {
  const db = database();
  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(input.email)
    .first<{ id: string }>();
  if (existing) return { ok: false, error: "email-taken" };

  const passwordHash = await hashPassword(input.password);
  const userId = crypto.randomUUID();
  const sessionId = newSessionId();
  const now = Date.now();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO users (id, email, password_hash, native_language, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(userId, input.email, passwordHash, input.nativeLanguage, now),
      db
        .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(sessionId, userId, now + sessionMaxAgeSeconds * 1000),
    ]);
  } catch (error) {
    if (isEmailTaken(error)) return { ok: false, error: "email-taken" };
    throw error;
  }
  writeSessionCookie(sessionId);
  return { ok: true };
}

export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const db = database();
  const [row, fallback] = await Promise.all([
    db
      .prepare("SELECT id, password_hash FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string; password_hash: string }>(),
    placeholderPasswordHash(),
  ]);
  const matches = await verifyPassword(password, row?.password_hash ?? fallback);
  if (!row || !matches) return { ok: false, error: "invalid-credentials" };
  await issueSession(row.id);
  return { ok: true };
}

async function issueSession(userId: string): Promise<void> {
  const db = database();
  const sessionId = newSessionId();
  const expiresAt = Date.now() + sessionMaxAgeSeconds * 1000;
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    db
      .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(sessionId, userId, expiresAt),
  ]);
  writeSessionCookie(sessionId);
}

export async function signOutCurrent(): Promise<void> {
  let sessionId: string | null = null;
  try {
    sessionId = readSessionId();
  } catch {
    sessionId = null;
  }
  clearSessionCookie();
  if (sessionId === null) return;
  try {
    await database().prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  } catch {
    // The browser cookie is already cleared.
  }
}

export async function setUserNativeLanguage(
  userId: string,
  nativeLanguage: "uk" | "ru",
): Promise<void> {
  await database()
    .prepare("UPDATE users SET native_language = ? WHERE id = ?")
    .bind(nativeLanguage, userId)
    .run();
}
