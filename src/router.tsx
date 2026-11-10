import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { fallbackReaderSettings } from "#/preferences/settings";
import { routeTree } from "./routeTree.gen";
import { NotFoundPage, RouteErrorPage, RoutePending } from "#/routes/-status-pages";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultStaleTime: 60_000,
    defaultPreloadStaleTime: 60_000,
    defaultPendingMs: 300,
    defaultViewTransition: {
      types: () =>
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? false
          : [],
    },
    defaultPendingComponent: RoutePending,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: RouteErrorPage,
    context: { user: null, settings: fallbackReaderSettings },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
