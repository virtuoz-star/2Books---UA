import { createAuthClient } from "better-auth/client";

export function signInWithGoogle(nativeLanguage: "uk" | "ru", redirectTo?: string) {
  const authClient = createAuthClient();
  const callbackURL = redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  const errorCallbackURL =
    callbackURL === "/" ? "/sign-in" : `/sign-in?redirect=${encodeURIComponent(callbackURL)}`;
  return authClient.signIn.social({
    provider: "google",
    callbackURL,
    errorCallbackURL,
    additionalData: { nativeLanguage },
  });
}
