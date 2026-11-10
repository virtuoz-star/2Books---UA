import { expect, test } from "vite-plus/test";

import { paperFromStorage, themeFlashScript } from "#/components/theme-paper";
import { SETTINGS_STORAGE_KEY } from "#/preferences/settings";

test("a missing or invalid paper follows the system", () => {
  expect(paperFromStorage(null)).toBe("auto");
  expect(paperFromStorage("")).toBe("auto");
  expect(paperFromStorage("{")).toBe("auto");
  expect(paperFromStorage("[]")).toBe("auto");
  expect(paperFromStorage(JSON.stringify({ readingPaper: "sepia" }))).toBe("auto");
  expect(paperFromStorage(JSON.stringify({ interfaceLocale: "uk" }))).toBe("auto");
});

test("an explicit paper is kept", () => {
  expect(paperFromStorage(JSON.stringify({ readingPaper: "lagoon" }))).toBe("lagoon");
  expect(paperFromStorage(JSON.stringify({ readingPaper: "ivory" }))).toBe("ivory");
  expect(paperFromStorage(JSON.stringify({ readingPaper: "night" }))).toBe("night");
});

function runFlash(raw: string | null): {
  paper?: string;
  font?: string;
  size?: string;
  lang?: string;
} {
  const dataset: { paper?: string; font?: string; size?: string } = {};
  const root: { dataset: typeof dataset; lang?: string } = { dataset };
  const previousDocument = globalThis.document;
  const previousStorage = globalThis.localStorage;
  Object.assign(globalThis, {
    document: { documentElement: root },
    localStorage: {
      getItem(key: string) {
        return key === SETTINGS_STORAGE_KEY ? raw : null;
      },
    },
  });
  try {
    new Function(themeFlashScript)();
    return { paper: dataset.paper, font: dataset.font, size: dataset.size, lang: root.lang };
  } finally {
    globalThis.document = previousDocument;
    globalThis.localStorage = previousStorage;
  }
}

test("the pre-paint script matches stored paper, font, size, and language", () => {
  expect(themeFlashScript).toContain(SETTINGS_STORAGE_KEY);
  expect(runFlash(null).paper).toBe("auto");
  expect(runFlash("not-json").paper).toBe("auto");
  expect(runFlash(JSON.stringify({ readingPaper: "ivory" })).paper).toBe("ivory");
  const saved = runFlash(
    JSON.stringify({
      readingPaper: "night",
      readingFont: "plain",
      readingSize: "large",
      interfaceLocale: "en",
    }),
  );
  expect(saved).toMatchObject({ paper: "night", font: "plain", size: "large", lang: "en" });
});
