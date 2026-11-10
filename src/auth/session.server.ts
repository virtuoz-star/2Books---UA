import { env } from "cloudflare:workers";
import { getRequest } from "@tanstack/react-start/server";

import { isListedAdmin } from "#/auth/admins";
import { getAuth } from "#/auth/auth.server";
import { database } from "#/auth/db.server";
import { createRequestMemo } from "#/auth/request-memo";
import type { CurrentUser } from "#/auth/session";

function nativeLanguageOf(value: unknown): CurrentUser["nativeLanguage"] {
  return value === "ru" ? "ru" : "uk";
}

function roleOf(value: unknown): CurrentUser["role"] {
  return value === "admin" ? "admin" : "user";
}

async function loadCurrentUser(request: Request): Promise<CurrentUser | null> {
  const auth = getAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  const user = session?.user;
  if (!user) return null;
  if (user.banned === true) return null;
  let role = roleOf(user.role);
  // ADMIN_EMAILS wins over the stored role on every read. Taking an address off
  // the list does not demote the account: do that from the admin page afterwards.
  if (role !== "admin" && isListedAdmin(user.email, env.ADMIN_EMAILS)) {
    await database()
      .prepare('UPDATE "user" SET role = ? WHERE id = ?')
      .bind("admin", user.id)
      .run();
    role = "admin";
  }
  const name = typeof user.name === "string" ? user.name : "";
  return {
    id: user.id,
    email: user.email,
    name,
    nativeLanguage: nativeLanguageOf(user.nativeLanguage),
    role,
  };
}

// One page load runs several server functions inside the same HTTP request
// (the root route, the page loader, the reader). They share one session read.
const sessionReads = createRequestMemo<Request, CurrentUser | null>(loadCurrentUser);

export async function readCurrentUser(): Promise<CurrentUser | null> {
  const user = await sessionReads.read(getRequest());
  // Callers get their own copy, so one of them cannot change what the next sees.
  return user ? { ...user } : null;
}

// Call after anything that changes the session or a user row (sign-out, role,
// ban, delete, language), so a later read in the same request is not stale.
export function forgetCurrentUser(): void {
  try {
    sessionReads.forget(getRequest());
  } catch {
    // Outside a request there is nothing remembered.
  }
}

export async function signOutCurrent(): Promise<void> {
  const request = getRequest();
  try {
    await getAuth(request).api.signOut({ headers: request.headers });
  } finally {
    forgetCurrentUser();
  }
}

export async function setUserNativeLanguage(
  userId: string,
  nativeLanguage: "uk" | "ru",
): Promise<void> {
  try {
    await database()
      .prepare('UPDATE "user" SET "nativeLanguage" = ? WHERE id = ?')
      .bind(nativeLanguage, userId)
      .run();
  } finally {
    forgetCurrentUser();
  }
}
