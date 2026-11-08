import { expect, test } from "vite-plus/test";

import { languageName, message, sentenceLabel } from "#/i18n/messages";
import type { MessageKey } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";

const locales = ["uk", "ru", "en"] as const satisfies readonly Locale[];

const messages: Record<Locale, Record<MessageKey, string>> = {
  uk: {
    appName: "2books",
    interfaceLanguage: "Мова інтерфейсу",
    nativeLanguage: "Мова перекладу",
    hint: "Оберіть речення, щоб побачити переклад.",
    translation: "Переклад",
    dismiss: "Сховати переклад",
    catalogHeading: "Книги",
    openBook: "Читати",
    continueReading: "Продовжити читання",
    previousChapter: "Попередня частина",
    nextChapter: "Наступна частина",
    chapterHeading: "Частина",
    signIn: "Увійти",
    signUp: "Створити обліковий запис",
    signOut: "Вийти",
    email: "Електронна пошта",
    password: "Пароль",
    uploadTitle: "Додати свій текст",
    uploadAction: "Зберегти текст",
    uploadHint: "Вставте текст англійською. Переклад з’явиться після вирівнювання.",
    noTranslation: "Перекладу цього речення ще немає.",
    dictionary: "Словник",
    noDictionaryEntry: "У словнику немає цього слова.",
    myBooks: "Мої тексти",
    alignmentPending: "Переклад ще не готовий",
    emailTaken: "Ця адреса вже зареєстрована.",
    invalidCredentials: "Невірна пошта або пароль.",
    invalidInput: "Перевірте пошту й пароль (щонайменше 8 символів).",
    anonymous: "Увійдіть, щоб зберегти текст.",
    tooLong: "Текст задовгий.",
    needAccount: "Немає облікового запису?",
    haveAccount: "Вже є обліковий запис?",
  },
  ru: {
    appName: "2books",
    interfaceLanguage: "Язык интерфейса",
    nativeLanguage: "Язык перевода",
    hint: "Выберите предложение, чтобы увидеть перевод.",
    translation: "Перевод",
    dismiss: "Скрыть перевод",
    catalogHeading: "Книги",
    openBook: "Читать",
    continueReading: "Продолжить чтение",
    previousChapter: "Предыдущая часть",
    nextChapter: "Следующая часть",
    chapterHeading: "Часть",
    signIn: "Войти",
    signUp: "Создать учётную запись",
    signOut: "Выйти",
    email: "Эл. почта",
    password: "Пароль",
    uploadTitle: "Добавить свой текст",
    uploadAction: "Сохранить текст",
    uploadHint: "Вставьте английский текст. Перевод появится после выравнивания.",
    noTranslation: "Перевода этого предложения ещё нет.",
    dictionary: "Словарь",
    noDictionaryEntry: "В словаре нет этого слова.",
    myBooks: "Мои тексты",
    alignmentPending: "Перевод ещё не готов",
    emailTaken: "Этот адрес уже зарегистрирован.",
    invalidCredentials: "Неверная почта или пароль.",
    invalidInput: "Проверьте почту и пароль (не меньше 8 символов).",
    anonymous: "Войдите, чтобы сохранить текст.",
    tooLong: "Текст слишком длинный.",
    needAccount: "Нет учётной записи?",
    haveAccount: "Уже есть учётная запись?",
  },
  en: {
    appName: "2books",
    interfaceLanguage: "Interface language",
    nativeLanguage: "Translation language",
    hint: "Select a sentence to see its translation.",
    translation: "Translation",
    dismiss: "Hide translation",
    catalogHeading: "Books",
    openBook: "Read",
    continueReading: "Continue reading",
    previousChapter: "Previous part",
    nextChapter: "Next part",
    chapterHeading: "Part",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    uploadTitle: "Add your text",
    uploadAction: "Save text",
    uploadHint: "Paste English text. A translation appears after alignment.",
    noTranslation: "This sentence has no translation yet.",
    dictionary: "Dictionary",
    noDictionaryEntry: "This word is not in the dictionary.",
    myBooks: "My texts",
    alignmentPending: "Translation is not ready yet",
    emailTaken: "This email is already registered.",
    invalidCredentials: "Wrong email or password.",
    invalidInput: "Check the email and use at least 8 characters.",
    anonymous: "Sign in to save a text.",
    tooLong: "That text is too long.",
    needAccount: "No account yet?",
    haveAccount: "Already have an account?",
  },
};

const languageNames: Record<Locale, Record<Locale, string>> = {
  uk: { uk: "Українська", ru: "Російська", en: "Англійська" },
  ru: { uk: "Украинский", ru: "Русский", en: "Английский" },
  en: { uk: "Ukrainian", ru: "Russian", en: "English" },
};

const sentenceLabels: Record<Locale, string> = {
  uk: "Речення 5",
  ru: "Предложение 5",
  en: "Sentence 5",
};

test("every message matches the spec in all three locales", () => {
  for (const locale of locales) {
    for (const key of Object.keys(messages[locale]) as MessageKey[]) {
      expect(message(locale, key)).toBe(messages[locale][key]);
    }
  }
});

test("language names match the spec in all three locales", () => {
  for (const locale of locales) {
    for (const language of locales) {
      expect(languageName(locale, language)).toBe(languageNames[locale][language]);
    }
  }
});

test("sentence labels replace {n} with the sentence number", () => {
  for (const locale of locales) {
    expect(sentenceLabel(locale, 5)).toBe(sentenceLabels[locale]);
  }
});
