import { expect, test } from "bun:test";

import { parseSavedWordStore, type SavedWordStore } from "../../../../src/dictionary/saved-words";
import { resolvedImportName } from "../local-plan";
import { parseStoredSettings } from "../reading-settings";
import { contrastRatio, palettes } from "../theme-tokens";
import { syncPlan } from "../word-sync-plan";

const word = {
  word: "hope",
  gloss: "надія",
  nativeLanguage: "uk" as const,
  savedAt: 10,
  sentenceEn: "I hope.",
  sentenceNative: "Я сподіваюсь.",
};

function store(savedAt: number, gloss = word.gloss): SavedWordStore {
  return parseSavedWordStore({ words: [{ ...word, savedAt, gloss }], tombstones: [] });
}

test("reading colors meet contrast floors", () => {
  for (const palette of Object.values(palettes)) {
    expect(contrastRatio(palette.ink, palette.paper) >= 4.5).toBe(true);
    expect(contrastRatio(palette.ink, palette.blotter) >= 4.5).toBe(true);
    expect(contrastRatio(palette.quiet, palette.paper) >= 4.5).toBe(true);
    expect(contrastRatio(palette.onAccent, palette.tide) >= 4.5).toBe(true);
    expect(contrastRatio(palette.markerInk, palette.marker) >= 4.5).toBe(true);
    expect(contrastRatio(palette.onDanger, palette.danger) >= 4.5).toBe(true);
    expect(contrastRatio(palette.disabledInk, palette.disabledFill) >= 4.5).toBe(true);
    expect(contrastRatio(palette.edge, palette.paper) >= 3).toBe(true);
    expect(contrastRatio(palette.edge, palette.blotter) >= 3).toBe(true);
  }
});

test("an old settings file keeps its languages and fills reading defaults", () => {
  const parsed = parseStoredSettings(
    JSON.stringify({ interfaceLocale: "en", nativeLanguage: "ru" }),
  );
  expect(parsed).toEqual({
    interfaceLocale: "en",
    nativeLanguage: "ru",
    readingFont: "literary",
    readingSize: "regular",
    readingPaper: "auto",
    hintSeen: false,
    wordHintSeen: false,
  });
});

test("sync skips an equal merge, writes locally when the server is ahead, and puts local edits", () => {
  const same = store(10);
  expect(syncPlan(same, same)).toEqual({ action: "skip" });
  const ahead = store(20);
  expect(syncPlan(same, ahead).action).toBe("write-local");
  expect(syncPlan(ahead, same).action).toBe("put");
});

test("import names come from file URIs, not content providers", () => {
  expect(resolvedImportName("content://provider/0.1", null)).toBeNull();
  expect(resolvedImportName("file:///tmp/Story.2books", null)).toBe("Story.2books");
  expect(resolvedImportName("content://provider/0.1", "Named.2books")).toBe("Named.2books");
});
