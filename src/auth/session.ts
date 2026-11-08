import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import { normalizeEmail } from "#/auth/email";
import { passwordAcceptable } from "#/auth/password";

export type CurrentUser = { id: string; email: string; nativeLanguage: "uk" | "ru" };

export type AuthResult =
  | { ok: true }
  | { ok: false; error: "invalid-input" | "email-taken" | "invalid-credentials" | "unavailable" };

function privateNoStore(): void {
  try {
    setResponseHeader("Cache-Control", "private, no-store");
    setResponseHeader("Vary", "Cookie");
  } catch {
    // A missing response context must not block the session read.
  }
}

function assertNativeLanguage(value: unknown): "uk" | "ru" {
  if (value !== "uk" && value !== "ru") throw new Error("invalid native language");
  return value;
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    try {
      privateNoStore();
      const { readCurrentUser } = await import("#/auth/session.server");
      return await readCurrentUser();
    } catch {
      return null;
    }
  },
);

export const signUp = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string; nativeLanguage: "uk" | "ru" }) => {
    return {
      email: typeof input?.email === "string" ? input.email : "",
      password: typeof input?.password === "string" ? input.password : "",
      nativeLanguage: assertNativeLanguage(input?.nativeLanguage),
    };
  })
  .handler(async ({ data }): Promise<AuthResult> => {
    privateNoStore();
    const email = normalizeEmail(data.email);
    if (email === null || !passwordAcceptable(data.password)) {
      return { ok: false, error: "invalid-input" };
    }
    try {
      const { createAccount } = await import("#/auth/session.server");
      return await createAccount({
        email,
        password: data.password,
        nativeLanguage: data.nativeLanguage,
      });
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const signIn = createServerFn({ method: "POST" })
  .validator((input: { email: string; password: string }) => {
    return {
      email: typeof input?.email === "string" ? input.email : "",
      password: typeof input?.password === "string" ? input.password : "",
    };
  })
  .handler(async ({ data }): Promise<AuthResult> => {
    privateNoStore();
    const email = normalizeEmail(data.email);
    if (email === null || !passwordAcceptable(data.password)) {
      return { ok: false, error: "invalid-input" };
    }
    try {
      const { authenticate } = await import("#/auth/session.server");
      return await authenticate(email, data.password);
    } catch {
      return { ok: false, error: "unavailable" };
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    privateNoStore();
    try {
      const { signOutCurrent } = await import("#/auth/session.server");
      await signOutCurrent();
    } catch {
      // The cookie clear lives in the server module. Sign-out still reports success.
    }
    return { ok: true };
  },
);

export const updateNativeLanguage = createServerFn({ method: "POST" })
  .validator((input: { nativeLanguage: "uk" | "ru" }) => {
    return { nativeLanguage: assertNativeLanguage(input?.nativeLanguage) };
  })
  .handler(
    async ({ data }): Promise<{ ok: true } | { ok: false; error: "anonymous" | "unavailable" }> => {
      privateNoStore();
      try {
        const { readCurrentUser, setUserNativeLanguage } = await import("#/auth/session.server");
        const user = await readCurrentUser();
        if (!user) return { ok: false, error: "anonymous" };
        await setUserNativeLanguage(user.id, data.nativeLanguage);
        return { ok: true };
      } catch {
        return { ok: false, error: "unavailable" };
      }
    },
  );
