import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { getCachedCurrentUser, type CurrentUser } from "#/auth/session";
import { themeColor, themeFlashScript } from "#/components/theme-paper";
import { message } from "#/i18n/messages";
import {
  fallbackReaderSettings,
  readSettingsFromCookie,
  type ReaderSettings,
} from "#/preferences/settings";
import { NotFoundPage, RouteErrorPage } from "#/routes/-status-pages";
import { AppShell } from "#/shell/app-header";
import literataCyrillic from "@fontsource-variable/literata/files/literata-cyrillic-standard-normal.woff2?url";
import literataLatin from "@fontsource-variable/literata/files/literata-latin-standard-normal.woff2?url";
import manropeCyrillic from "@fontsource-variable/manrope/files/manrope-cyrillic-wght-normal.woff2?url";
import appCss from "../styles.css?url";

function acceptLanguages(header: string | null): string[] {
  if (header === null || header === "") return [];
  return header
    .split(",")
    .map((part) => part.split(";")[0]?.trim() ?? "")
    .filter((part) => part.length > 0);
}

async function readRouteSettings(): Promise<ReaderSettings> {
  if (typeof window !== "undefined") {
    const languages = navigator.languages ?? [];
    return readSettingsFromCookie(document.cookie, languages);
  }
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    return readSettingsFromCookie(
      request.headers.get("cookie"),
      acceptLanguages(request.headers.get("accept-language")),
    );
  } catch {
    return fallbackReaderSettings;
  }
}

export const Route = createRootRouteWithContext<{
  user: CurrentUser | null;
  settings: ReaderSettings;
}>()({
  beforeLoad: async () => {
    const settings = await readRouteSettings();
    try {
      return { user: await getCachedCurrentUser(), settings };
    } catch {
      return { user: null, settings };
    }
  },
  head: ({ match }) => {
    const locale = match.context.settings?.interfaceLocale ?? "uk";
    const description = message(locale, "appDescription");
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "2books" },
        { name: "description", content: description },
        { property: "og:title", content: "2books" },
        { property: "og:description", content: description },
        { property: "og:image", content: "/og.png" },
        { property: "og:type", content: "website" },
      ],
      links: [
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
        {
          rel: "preload",
          href: literataLatin,
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        {
          rel: "preload",
          href: literataCyrillic,
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        {
          rel: "preload",
          href: manropeCyrillic,
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        { rel: "stylesheet", href: appCss },
      ],
    };
  },
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { settings } = Route.useRouteContext();
  const paper = settings.readingPaper;
  return (
    <html
      lang={settings.interfaceLocale}
      data-paper={paper}
      data-font={settings.readingFont}
      data-size={settings.readingSize}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeFlashScript }} />
        {paper === "auto" ? (
          <>
            <meta name="theme-color" content={themeColor.lagoon} media="(prefers-color-scheme: light)" />
            <meta name="theme-color" content={themeColor.night} media="(prefers-color-scheme: dark)" />
          </>
        ) : (
          <meta name="theme-color" content={themeColor[paper]} />
        )}
        <HeadContent />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
