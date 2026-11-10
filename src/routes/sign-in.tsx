import { createFileRoute, redirect } from "@tanstack/react-router";

import { googleSignInReady } from "#/auth/session";
import { SignInPanel } from "#/auth/sign-in-panel";
import { PageHeader } from "#/components/ui/page-header";
import { documentTitle, message, safeRedirectPath } from "#/i18n/messages";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { useNativeLanguage } from "#/shell/reading-language";

function redirectSignedIn(signedIn: boolean, href: string): void {
  if (signedIn) throw redirect({ href });
}

const signInRoute = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { error?: string; redirect?: string } => {
    const next = safeRedirectPath(search.redirect);
    const error =
      typeof search.error === "string" && search.error.length > 0 && search.error.length <= 200
        ? search.error
        : undefined;
    return { ...(error ? { error } : {}), ...(next ? { redirect: next } : {}) };
  },
  beforeLoad: ({ context, search }) => {
    redirectSignedIn(context.user !== null, search.redirect ?? "/");
  },
  loader: () => googleSignInReady(),
  component: SignInPage,
});

export const Route = signInRoute.update({
  head: ({ match }) => ({
    meta: [{ title: documentTitle(message(match.context.settings.interfaceLocale, "signIn")) }],
  }),
});

function SignInPage() {
  const ready = Route.useLoaderData();
  const { error: authError, redirect: redirectTo } = Route.useSearch();
  const { settings } = useReaderSettings();
  const nativeLanguage = useNativeLanguage();
  const locale = settings.interfaceLocale;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title={message(locale, "signIn")} />
      <SignInPanel
        locale={locale}
        nativeLanguage={nativeLanguage}
        ready={ready}
        authError={Boolean(authError)}
        redirectTo={redirectTo}
      />
    </div>
  );
}
