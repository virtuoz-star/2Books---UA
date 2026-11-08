import { createAuthClient } from "better-auth/client";

export function signInWithGoogle(nativeLanguage: "uk" | "ru") {
  const authClient = createAuthClient();
  return authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
    errorCallbackURL: "/sign-in",
    additionalData: { nativeLanguage },
  });
}
