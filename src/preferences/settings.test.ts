import { expect, test } from "vite-plus/test";

import {
  readSettings,
  SETTINGS_STORAGE_KEY,
  writeSettings,
  type ReaderSettings,
} from "#/preferences/settings";

const englishBrowser = ["en-US"] as const;
const englishDefaults: ReaderSettings = {
  interfaceLocale: "en",
  nativeLanguage: "uk",
};

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
  expect(readSettings(null, ["ru-RU"])).toEqual({
    interfaceLocale: "ru",
    nativeLanguage: "ru",
  });
  expect(readSettings(null, [])).toEqual({
    interfaceLocale: "uk",
    nativeLanguage: "uk",
  });
});

test("a missing key returns browser defaults", () => {
  const storage = {
    getItem(key: string) {
      expect(key).toBe(SETTINGS_STORAGE_KEY);
      return null;
    },
  };
  expect(readSettings(storage, ["ru-RU"])).toEqual({
    interfaceLocale: "ru",
    nativeLanguage: "ru",
  });
  expect(readSettings(memoryStorage(""), englishBrowser)).toEqual(englishDefaults);
});

test("corrupt JSON returns browser defaults", () => {
  for (const raw of ["{", "not-json", "null", "[]", '"en"', "1"]) {
    expect(readSettings(memoryStorage(raw), englishBrowser)).toEqual(englishDefaults);
  }
});

test("a valid field is kept when the other is missing or invalid", () => {
  expect(readSettings(memoryStorage(JSON.stringify({ interfaceLocale: "en" })), ["ru-RU"])).toEqual(
    { interfaceLocale: "en", nativeLanguage: "ru" },
  );

  expect(
    readSettings(memoryStorage(JSON.stringify({ nativeLanguage: "ru" })), englishBrowser),
  ).toEqual({ interfaceLocale: "en", nativeLanguage: "ru" });

  expect(
    readSettings(
      memoryStorage(JSON.stringify({ interfaceLocale: "de", nativeLanguage: "ru" })),
      englishBrowser,
    ),
  ).toEqual({ interfaceLocale: "en", nativeLanguage: "ru" });

  expect(
    readSettings(memoryStorage(JSON.stringify({ interfaceLocale: "ru", nativeLanguage: "en" })), [
      "de-DE",
    ]),
  ).toEqual({ interfaceLocale: "ru", nativeLanguage: "uk" });

  expect(
    readSettings(memoryStorage(JSON.stringify({ interfaceLocale: "EN", nativeLanguage: "RU" })), [
      "uk-UA",
    ]),
  ).toEqual({ interfaceLocale: "uk", nativeLanguage: "uk" });
});

test("settings round-trip through a plain storage object", () => {
  const storage = memoryStorage();
  const settings: ReaderSettings = { interfaceLocale: "en", nativeLanguage: "ru" };

  writeSettings(storage, settings);

  expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBe(JSON.stringify(settings));
  expect(Object.keys(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? ""))).toEqual([
    "interfaceLocale",
    "nativeLanguage",
  ]);
  expect(readSettings(storage, ["de-DE"])).toEqual(settings);
});

test("readSettings ignores fields other than the two settings", () => {
  const storage = memoryStorage(
    JSON.stringify({ interfaceLocale: "en", nativeLanguage: "ru", theme: "dark" }),
  );
  expect(readSettings(storage, ["de-DE"])).toEqual({
    interfaceLocale: "en",
    nativeLanguage: "ru",
  });
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
