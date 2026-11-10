import { Link, useRouter } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import { message } from "#/i18n/messages";
import { useReaderSettings } from "#/reader/use-reader-settings";

export function RoutePending() {
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label={message(locale, "loading")}>
      <div className="skeleton h-7 w-2/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-11/12" />
      <div className="skeleton h-4 w-4/5" />
      <div className="skeleton mt-4 h-4 w-full" />
      <div className="skeleton h-4 w-10/12" />
    </div>
  );
}

export function NotFoundPage() {
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  return (
    <section className="flex flex-col items-start gap-4 py-8">
      <h1 className="display-title text-2xl text-foreground">{message(locale, "notFoundTitle")}</h1>
      <p className="text-muted-foreground">{message(locale, "notFoundBody")}</p>
      <Button asChild>
        <Link to="/">{message(locale, "backToBooks")}</Link>
      </Button>
    </section>
  );
}

export function RouteErrorPage({ reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  return (
    <section className="flex flex-col items-start gap-4 py-8">
      <h1 className="display-title text-2xl text-foreground">{message(locale, "errorTitle")}</h1>
      <p className="text-muted-foreground">{message(locale, "errorBody")}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          {message(locale, "retryAction")}
        </Button>
        <Button asChild variant="secondary">
          <Link to="/">{message(locale, "backToBooks")}</Link>
        </Button>
      </div>
    </section>
  );
}
