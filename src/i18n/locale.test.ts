import { expect, test } from "vite-plus/test";

import { defaultInterfaceLocale, defaultNativeLanguage } from "#/i18n/locale";

test.each([
  ["ru-RU", "ru", "ru"],
  ["en-US", "en", "uk"],
  ["uk-UA", "uk", "uk"],
  ["de-DE", "uk", "uk"],
] as const)(
  "first tag %s defaults interface to %s and native to %s",
  (tag, interfaceLocale, nativeLanguage) => {
    expect(defaultInterfaceLocale([tag])).toBe(interfaceLocale);
    expect(defaultNativeLanguage([tag])).toBe(nativeLanguage);
  },
);

test("an empty language list defaults both languages to Ukrainian", () => {
  expect(defaultInterfaceLocale([])).toBe("uk");
  expect(defaultNativeLanguage([])).toBe("uk");
});

test("defaults use only the first tag, ignoring case", () => {
  expect(defaultInterfaceLocale(["DE-de", "ru-RU"])).toBe("uk");
  expect(defaultNativeLanguage(["DE-de", "ru-RU"])).toBe("uk");
  expect(defaultInterfaceLocale(["EN-us", "ru"])).toBe("en");
  expect(defaultNativeLanguage(["EN-us", "ru"])).toBe("uk");
  expect(defaultInterfaceLocale(["RU"])).toBe("ru");
  expect(defaultNativeLanguage(["RU"])).toBe("ru");
  expect(defaultInterfaceLocale(["", "ru-RU"])).toBe("uk");
  expect(defaultNativeLanguage(["", "ru-RU"])).toBe("uk");
});
