import { expect, test } from "vite-plus/test";

import {
  readSettings,
  readSettingsFromCookie,
  SETTINGS_COOKIE,
  SETTINGS_STORAGE_KEY,
  settingsCookieAssignment,
  writeSettings,
  type ReaderSettings,
} from "#/preferences/settings";

const englishBrowser = ["en-US"] as const;
const readingDefaults = {
  readingFont: "literary",
  readingSize: "regular",
  readingPaper: "auto",
  translationMode: "tap",
  hintSeen: false,
} as const satisfies Pick<
  ReaderSettings,
  "readingFont" | "readingSize" | "readingPaper" | "translationMode" | "hintSeen"
>;

const englishDefaults: ReaderSettings = {
  interfaceLocale: "en",
  nativeLanguage: "uk",
  ...readingDefaults,
};

function saved(
  interfaceLocale: ReaderSettings["interfaceLocale"],
  nativeLanguage: ReaderSettings["nativeLanguage"],
  reading: Partial<Pick<ReaderSettings, "readingFont" | "readingSize" | "readingPaper">> = {},
): ReaderSettings {
  return { interfaceLocale, nativeLanguage, ...readingDefaults, ...reading };
}

function memoryStorage(initial?: string) {
  const items: Record<string, string> = {};
  if (initial !== undefined) items[SETTINGS_STORAGE_KEY] = initial;
  return {
    getItem(key: string) {
      return Object.hasOwn(items, key) ? items[key] : null;
    },
    setItem(key: string, value: string) {
      items[key] = value;
    },
  };
}

test("null storage returns browser defaults and does not throw", () => {
  expect(readSettings(null, englishBrowser)).toEqual(englishDefaults);
  expect(readSettings(null, ["ru-RU"])).toEqual(saved("ru", "ru"));
  expect(readSettings(null, [])).toEqual(saved("uk", "uk"));
});

test("a missing key returns browser defaults", () => {
  const storage = {
    getItem(key: string) {
      expect(key).toBe(SETTINGS_STORAGE_KEY);
      return null;
    },
  };
  expect(readSettings(storage, ["ru-RU"])).toEqual(saved("ru", "ru"));
  expect(readSettings(memoryStorage(""), englishBrowser)).toEqual(englishDefaults);
});

test("corrupt JSON returns browser defaults", () => {
  for (const raw of ["{", "not-json", "null", "[]", '"en"', "1"]) {
    expect(readSettings(memoryStorage(raw), englishBrowser)).toEqual(englishDefaults);
  }
});

test("a valid field is kept when the other is missing or invalid", () => {
  expect(readSettings(memoryStorage(JSON.stringify({ interfaceLocale: "en" })), ["ru-RU"])).toEqual(
    saved("en", "ru"),
  );

  expect(
    readSettings(memoryStorage(JSON.stringify({ nativeLanguage: "ru" })), englishBrowser),
  ).toEqual(saved("en", "ru"));

  expect(
    readSettings(
      memoryStorage(JSON.stringify({ interfaceLocale: "de", nativeLanguage: "ru" })),
      englishBrowser,
    ),
  ).toEqual(saved("en", "ru"));

  expect(
    readSettings(memoryStorage(JSON.stringify({ interfaceLocale: "ru", nativeLanguage: "en" })), [
      "de-DE",
    ]),
  ).toEqual(saved("ru", "uk"));

  expect(
    readSettings(memoryStorage(JSON.stringify({ interfaceLocale: "EN", nativeLanguage: "RU" })), [
      "uk-UA",
    ]),
  ).toEqual(saved("uk", "uk"));
});

test("a valid reading choice is kept when another is missing or invalid", () => {
  expect(
    readSettings(
      memoryStorage(
        JSON.stringify({
          interfaceLocale: "en",
          readingFont: "classic",
          readingSize: "huge",
          readingPaper: "night",
        }),
      ),
      englishBrowser,
    ),
  ).toEqual(saved("en", "uk", { readingFont: "classic", readingPaper: "night" }));
});

test("settings round-trip through a plain storage object", () => {
  const storage = memoryStorage();
  const settings: ReaderSettings = saved("en", "ru", {
    readingFont: "plain",
    readingSize: "large",
    readingPaper: "ivory",
  });

  writeSettings(storage, settings);

  expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(settings));
  expect(Object.keys(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? ""))).toEqual([
    "interfaceLocale",
    "nativeLanguage",
    "readingFont",
    "readingSize",
    "readingPaper",
    "translationMode",
    "hintSeen",
  ]);
  expect(readSettings(storage, ["de-DE"])).toEqual(settings);
});

test("readSettings drops unknown fields", () => {
  const storage = memoryStorage(
    JSON.stringify({
      interfaceLocale: "en",
      nativeLanguage: "ru",
      readingFont: "plain",
      theme: "dark",
    }),
  );
  expect(readSettings(storage, ["de-DE"])).toEqual(saved("en", "ru", { readingFont: "plain" }));
});

test("writeSettings does nothing when storage is null", () => {
  expect(() => writeSettings(null, englishDefaults)).not.toThrow();
});

test("writeSettings swallows setItem errors", () => {
  const storage = {
    setItem() {
      throw new Error("quota exceeded");
    },
  };
  expect(() => writeSettings(storage, englishDefaults)).not.toThrow();
});

test("a missing paper stays auto and is not rewritten as lagoon", () => {
  const storage = memoryStorage(
    JSON.stringify({ interfaceLocale: "en", nativeLanguage: "uk", readingFont: "plain" }),
  );
  const read = readSettings(storage, englishBrowser);
  expect(read.readingPaper).toBe("auto");
  writeSettings(storage, { ...read, readingSize: "large" });
  const stored = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? "") as ReaderSettings;
  expect(stored.readingPaper).toBe("auto");
  expect(stored.readingSize).toBe("large");
  expect(stored.readingFont).toBe("plain");
});

test("an explicit paper round-trips, including auto", () => {
  const storage = memoryStorage();
  writeSettings(storage, saved("uk", "uk", { readingPaper: "auto" }));
  expect(readSettings(storage, englishBrowser).readingPaper).toBe("auto");
  writeSettings(storage, saved("uk", "uk", { readingPaper: "night" }));
  expect(readSettings(storage, ["de"]).readingPaper).toBe("night");
});

test("the settings cookie mirrors storage and falls back when it is missing", () => {
  const settings = saved("en", "ru", { readingPaper: "ivory", readingFont: "classic" });
  const assignment = settingsCookieAssignment(settings);
  expect(assignment.startsWith(`${SETTINGS_COOKIE}=`)).toBe(true);
  const header = assignment.split(";")[0] ?? "";
  expect(readSettingsFromCookie(header, ["de-DE"])).toEqual(settings);
  expect(readSettingsFromCookie(null, englishBrowser)).toEqual(englishDefaults);
  expect(readSettingsFromCookie("other=1", ["ru-RU"]).readingPaper).toBe("auto");
});
