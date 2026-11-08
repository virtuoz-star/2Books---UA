import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  nativeLanguage: "uk" | "ru";
  role: "admin" | "user";
};

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

export const googleSignInReady = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    try {
      const { googleAuthConfigured } = await import("#/auth/auth.server");
      return googleAuthConfigured();
    } catch {
      return false;
    }
  },
);

export const signOut = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: true }> => {
    privateNoStore();
    try {
      const { signOutCurrent } = await import("#/auth/session.server");
      await signOutCurrent();
    } catch {
      // Sign-out still reports success when the session is already gone.
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
