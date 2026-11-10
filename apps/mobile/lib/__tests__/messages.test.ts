import { expect, test } from "bun:test";

import {
  languageName,
  message,
  partStudyLine,
  practiceLeftLine,
  practiceSummaryLine,
  type MessageKey,
} from "../messages";
import type { Locale } from "../types";

const locales = ["uk", "ru", "en"] as const satisfies readonly Locale[];

const added: Record<Locale, Partial<Record<MessageKey, string>>> = {
  uk: {
    translateWord: "Перекласти",
    translating: "Перекладаємо…",
    translateFailed: "Не вдалося перекласти це слово.",
    googleKeyLabel: "Ключ Google Перекладача",
    googleKeyHint: "Ключ лишається лише на цьому пристрої. 2books його не отримує.",
    googleKeySaved: "Ключ збережено на цьому пристрої.",
    googleKeySave: "Зберегти ключ",
    googleKeyClear: "Прибрати ключ",
    googleKeyTooLong: "Цей ключ задовгий.",
    listenSentence: "Прослухати речення",
    readPart: "Читати цю частину вголос",
    openInBook: "Відкрити в книзі",
    stopSpeech: "Зупинити",
    speakFailed: "Не вдалося прочитати речення.",
    syncFailed: "Не вдалося синхронізувати збережені слова.",
    signInBenefit: "Увійдіть, щоб синхронізувати слова між пристроєм і сайтом.",
    signInWithGoogle: "Увійти через Google",
    googleNotConfigured: "Вхід через Google ще не налаштовано.",
    googleSignInFailed: "Не вдалося почати вхід через Google.",
    signOut: "Вийти",
    downloadBook: "Зберегти на пристрій",
    downloading: "Завантажуємо…",
    downloadFailed: "Не вдалося завантажити книгу.",
    practice: "Практика",
    showAnswer: "Показати відповідь",
    againCard: "Ще раз",
    knowCard: "Знаю",
    practiceSummary: "Карток: {cards}. Потрібна ще спроба: {again}.",
    practiceMissed: "Повторити пропущені",
    practiceLeave: "Закрити",
    practiceLeft: "Залишилося: {count}",
    partStudy: "Ви відкрили перекладів: {translations}. Зберегли слів: {words}.",
  },
  ru: {
    translateWord: "Перевести",
    translating: "Переводим…",
    translateFailed: "Не удалось перевести это слово.",
    googleKeyLabel: "Ключ Google Переводчика",
    googleKeyHint: "Ключ остаётся только на этом устройстве. 2books его не получает.",
    googleKeySaved: "Ключ сохранён на этом устройстве.",
    googleKeySave: "Сохранить ключ",
    googleKeyClear: "Удалить ключ",
    googleKeyTooLong: "Этот ключ слишком длинный.",
    listenSentence: "Прослушать предложение",
    readPart: "Читать эту часть вслух",
    openInBook: "Открыть в книге",
    stopSpeech: "Остановить",
    speakFailed: "Не удалось прочитать предложение.",
    syncFailed: "Не удалось синхронизировать сохранённые слова.",
    signInBenefit: "Войдите, чтобы синхронизировать слова между устройством и сайтом.",
    signInWithGoogle: "Войти через Google",
    googleNotConfigured: "Вход через Google ещё не настроен.",
    googleSignInFailed: "Не удалось начать вход через Google.",
    signOut: "Выйти",
    downloadBook: "Сохранить на устройство",
    downloading: "Скачиваем…",
    downloadFailed: "Не удалось скачать книгу.",
    practice: "Практика",
    showAnswer: "Показать ответ",
    againCard: "Ещё раз",
    knowCard: "Знаю",
    practiceSummary: "Карточек: {cards}. Нужна ещё попытка: {again}.",
    practiceMissed: "Повторить пропущенные",
    practiceLeave: "Закрыть",
    practiceLeft: "Осталось: {count}",
    partStudy: "Вы открыли переводов: {translations}. Сохранили слов: {words}.",
  },
  en: {
    translateWord: "Translate",
    translating: "Translating…",
    translateFailed: "Could not translate this word.",
    googleKeyLabel: "Google Translate key",
    googleKeyHint: "The key stays on this device only. 2books never receives it.",
    googleKeySaved: "A key is saved on this device.",
    googleKeySave: "Save key",
    googleKeyClear: "Remove key",
    googleKeyTooLong: "That key is too long.",
    listenSentence: "Listen",
    readPart: "Read this part aloud",
    openInBook: "Open in the book",
    stopSpeech: "Stop",
    speakFailed: "Could not read this sentence.",
    syncFailed: "Could not sync saved words.",
    signInBenefit: "Sign in to sync words between this device and the website.",
    signInWithGoogle: "Sign in with Google",
    googleNotConfigured: "Google sign-in is not configured yet.",
    googleSignInFailed: "Could not start Google sign-in.",
    signOut: "Sign out",
    downloadBook: "Save to this device",
    downloading: "Downloading…",
    downloadFailed: "Could not download this book.",
    practice: "Practice",
    showAnswer: "Show the answer",
    againCard: "Again",
    knowCard: "Know it",
    practiceSummary: "{cards} cards. {again} needed another try.",
    practiceMissed: "Practice the missed ones",
    practiceLeave: "Leave",
    practiceLeft: "{count} left",
    partStudy: "You opened {translations} translations and saved {words} words.",
  },
};

test("new phone strings match in uk, ru, and en", () => {
  for (const locale of locales) {
    const catalog = added[locale];
    for (const key of Object.keys(catalog) as MessageKey[]) {
      expect(message(locale, key)).toBe(catalog[key]);
    }
  }
});

test("appName stays 2books", () => {
  for (const locale of locales) {
    expect(message(locale, "appName")).toBe("2books");
  }
});

test("practice and part lines fill their counts", () => {
  expect(practiceSummaryLine("en", 4, 1)).toBe("4 cards. 1 needed another try.");
  expect(practiceLeftLine("uk", 3)).toBe("Залишилося: 3");
  expect(partStudyLine("en", 14, 5)).toBe("You opened 14 translations and saved 5 words.");
  expect(partStudyLine("uk", 14, 5)).toBe("Ви відкрили перекладів: 14. Зберегли слів: 5.");
  expect(partStudyLine("ru", 14, 5)).toBe("Вы открыли переводов: 14. Сохранили слов: 5.");
  expect(practiceSummaryLine("uk", 4, 1)).toBe("Карток: 4. Потрібна ще спроба: 1.");
});

test("language names are autonyms", () => {
  expect(languageName("en", "uk")).toBe("Українська");
  expect(languageName("uk", "en")).toBe("English");
  expect(languageName("ru", "ru")).toBe("Русский");
});
