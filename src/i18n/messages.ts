import type { Locale } from "#/i18n/types";

export type MessageKey =
  | "appName"
  | "interfaceLanguage"
  | "nativeLanguage"
  | "hint"
  | "translation"
  | "dismiss"
  | "catalogHeading"
  | "openBook"
  | "continueReading"
  | "previousChapter"
  | "nextChapter"
  | "chapterHeading"
  | "signIn"
  | "signUp"
  | "signOut"
  | "email"
  | "password"
  | "uploadTitle"
  | "uploadAction"
  | "uploadHint"
  | "noTranslation"
  | "dictionary"
  | "noDictionaryEntry"
  | "myBooks"
  | "alignmentPending"
  | "emailTaken"
  | "invalidCredentials"
  | "invalidInput"
  | "anonymous"
  | "tooLong"
  | "needAccount"
  | "haveAccount";

type Catalog = Record<MessageKey | "sentenceLabel", string> & {
  language: Record<Locale, string>;
};

const catalogs = {
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
    sentenceLabel: "Речення {n}",
    language: {
      uk: "Українська",
      ru: "Російська",
      en: "Англійська",
    },
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
    sentenceLabel: "Предложение {n}",
    language: {
      uk: "Украинский",
      ru: "Русский",
      en: "Английский",
    },
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
    sentenceLabel: "Sentence {n}",
    language: {
      uk: "Ukrainian",
      ru: "Russian",
      en: "English",
    },
  },
} satisfies Record<Locale, Catalog>;

export function message(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function languageName(locale: Locale, language: Locale): string {
  return catalogs[locale].language[language];
}

export function sentenceLabel(locale: Locale, n: number): string {
  return catalogs[locale].sentenceLabel.replaceAll("{n}", String(n));
}
