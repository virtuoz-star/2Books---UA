import { env } from "cloudflare:workers";
import { getRequest, getRequestHeaders } from "@tanstack/react-start/server";

import { isListedAdmin } from "#/auth/admins";
import { getAuth } from "#/auth/auth.server";
import { database } from "#/auth/db.server";
import type { CurrentUser } from "#/auth/session";

function nativeLanguageOf(value: unknown): CurrentUser["nativeLanguage"] {
  return value === "ru" ? "ru" : "uk";
}

function roleOf(value: unknown): CurrentUser["role"] {
  return value === "admin" ? "admin" : "user";
}

export async function readCurrentUser(): Promise<CurrentUser | null> {
  const request = getRequest();
  const auth = getAuth(request);
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  const user = session?.user;
  if (!user) return null;
  if (user.banned === true) return null;
  let role = roleOf(user.role);
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

export async function signOutCurrent(): Promise<void> {
  const auth = getAuth(getRequest());
  await auth.api.signOut({ headers: getRequestHeaders() });
}

export async function setUserNativeLanguage(
  userId: string,
  nativeLanguage: "uk" | "ru",
): Promise<void> {
  await database()
    .prepare('UPDATE "user" SET "nativeLanguage" = ? WHERE id = ?')
    .bind(nativeLanguage, userId)
    .run();
}
