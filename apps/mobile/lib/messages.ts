import type { Locale } from "@/lib/types";

export type MessageKey =
  | "appName"
  | "books"
  | "read"
  | "previousPart"
  | "nextPart"
  | "translation"
  | "hint"
  | "sentenceHint"
  | "noTranslation"
  | "interfaceLanguage"
  | "nativeLanguage"
  | "loading"
  | "loadError"
  | "retry"
  | "emptyCatalog"
  | "emptyBook"
  | "parts"
  | "importBook"
  | "importing"
  | "importInvalid"
  | "importReserved"
  | "importFailed"
  | "onThisPhone"
  | "library"
  | "continueReading"
  | "settings"
  | "deleteBook"
  | "deleteConfirmTitle"
  | "deleteConfirmBody"
  | "cancel"
  | "catalogUnavailable"
  | "dismiss"
  | "dictionary"
  | "noDictionaryEntry"
  | "savedWords"
  | "saveWord"
  | "savedWord"
  | "removeWord"
  | "wordsEmpty"
  | "wordsSearch"
  | "wordsOther"
  | "switchLanguage"
  | "exportAnki"
  | "ankiHint"
  | "exportedCount"
  | "savedCount"
  | "shareFailed"
  | "undo"
  | "wordRemoved"
  | "textEnglish"
  | "textUkrainian"
  | "textRussian"
  | "translateWord"
  | "translating"
  | "translateFailed"
  | "translateExplain"
  | "addKeyHere"
  | "openInGoogle"
  | "googleKeyLabel"
  | "googleKeyHint"
  | "googleKeyPurpose"
  | "googleKeyPlaceholder"
  | "googleKeyHow"
  | "googleKeyShow"
  | "googleKeyHide"
  | "googleKeySaved"
  | "googleKeySave"
  | "googleKeyClear"
  | "googleKeyTooLong"
  | "googleKeySaveFailed"
  | "googleKeyClearTitle"
  | "googleKeyClearBody"
  | "googleKeyRemoved"
  | "listenSentence"
  | "readPart"
  | "openInBook"
  | "stopSpeech"
  | "speakFailed"
  | "wordHint"
  | "syncFailed"
  | "signInBenefit"
  | "signInWithGoogle"
  | "googleNotConfigured"
  | "googleSignInFailed"
  | "signOut"
  | "account"
  | "sessionCheckFailed"
  | "downloadBook"
  | "downloading"
  | "downloadFailed"
  | "savedOffline"
  | "open"
  | "partOf"
  | "nextPartNamed"
  | "finishedBook"
  | "readingSize"
  | "readingFont"
  | "readingPaper"
  | "fontLiterary"
  | "fontPlain"
  | "fontClassic"
  | "paperAuto"
  | "paperLagoon"
  | "paperIvory"
  | "paperNight"
  | "sizeSmall"
  | "sizeRegular"
  | "sizeLarge"
  | "close"
  | "back"
  | "menu"
  | "readingSettings"
  | "practice"
  | "showAnswer"
  | "againCard"
  | "knowCard"
  | "practiceSummary"
  | "practiceMissed"
  | "practiceLeave"
  | "practiceLeft"
  | "partStudy";

type Catalog = Record<MessageKey | "part" | "sentenceLabel", string> & {
  language: Record<Locale, string>;
  partOne: string;
  partFew: string;
  partMany: string;
};

const autonyms: Record<Locale, string> = {
  uk: "Українська",
  ru: "Русский",
  en: "English",
};

const catalogs = {
  uk: {
    appName: "2books",
    books: "Книги",
    read: "Читати",
    previousPart: "Попередня частина",
    nextPart: "Наступна частина",
    translation: "Переклад",
    hint: "Торкніться речення, щоб побачити переклад.",
    sentenceHint: "Двічі торкніться, щоб показати переклад",
    noTranslation: "Перекладу цього речення ще немає.",
    interfaceLanguage: "Мова інтерфейсу",
    nativeLanguage: "Мова перекладу",
    loading: "Завантаження…",
    loadError: "Не вдалося це завантажити.",
    retry: "Спробувати ще раз",
    emptyCatalog: "У каталозі ще немає книг.",
    emptyBook: "У цій книзі ще немає частин.",
    importBook: "Додати книгу з файлу",
    importing: "Читаємо файл…",
    importInvalid: "Цей файл не є книгою .2books, яку можна відкрити.",
    importReserved: "Ця книга вже є в каталозі. Файл не збережено.",
    importFailed: "Не вдалося зберегти книгу на пристрої.",
    onThisPhone: "На цьому пристрої",
    library: "Бібліотека",
    continueReading: "Продовжити читання",
    settings: "Налаштування",
    deleteBook: "Видалити з пристрою",
    deleteConfirmTitle: "Видалити цю книгу з пристрою?",
    deleteConfirmBody: "Файл і місце читання буде стерто. Книгу з каталогу це не зачепить.",
    cancel: "Скасувати",
    catalogUnavailable: "Каталог зараз недоступний. Книги на пристрої залишаються.",
    dismiss: "Сховати переклад",
    dictionary: "Словник",
    noDictionaryEntry: "У словнику немає цього слова.",
    savedWords: "Збережені слова",
    saveWord: "Зберегти слово",
    savedWord: "Збережено",
    removeWord: "Прибрати",
    wordsEmpty: "Ви ще не зберегли жодного слова.",
    wordsSearch: "Шукати слова",
    wordsOther: "Ще немає слів для мови «{language}». Для мови «{other}» збережено {count}.",
    switchLanguage: "Показати ці слова",
    exportAnki: "Експорт в Anki",
    ankiHint: "Відкрийте цей файл в Anki через Імпорт.",
    exportedCount: "Експортовано слів: {count}.",
    savedCount: "Збережено: {count}",
    shareFailed: "Не вдалося поділитися списком.",
    undo: "Вернути",
    wordRemoved: "Слово прибрано",
    textEnglish: "Англійською",
    textUkrainian: "Українською",
    textRussian: "Російською",
    translateWord: "Перекласти",
    translating: "Перекладаємо…",
    translateFailed: "Не вдалося перекласти це слово.",
    translateExplain:
      "Ключ Google Перекладача лишається на цьому пристрої й перекладає слова тут. Можна також відкрити Google Перекладач у браузері.",
    addKeyHere: "Додати ключ, щоб перекладати тут",
    openInGoogle: "Відкрити в Google Перекладачі",
    googleKeyLabel: "Ключ Google Перекладача",
    googleKeyHint: "Ключ лишається лише на цьому пристрої. 2books його не отримує.",
    googleKeyPurpose: "Ключ перекладає слова в книзі на цьому пристрої.",
    googleKeyPlaceholder: "Вставте ключ",
    googleKeyHow: "Як отримати ключ",
    googleKeyShow: "Показати ключ",
    googleKeyHide: "Сховати ключ",
    googleKeySaved: "Ключ збережено на цьому пристрої.",
    googleKeySave: "Зберегти ключ",
    googleKeyClear: "Прибрати ключ",
    googleKeyTooLong: "Цей ключ задовгий.",
    googleKeySaveFailed: "Не вдалося зберегти ключ. Спробуйте ще раз.",
    googleKeyClearTitle: "Прибрати ключ перекладу?",
    googleKeyClearBody: "Переклад слів на цьому пристрої зупиниться, доки ви знову не додасте ключ.",
    googleKeyRemoved: "Ключ прибрано з цього пристрою.",
    listenSentence: "Прослухати речення",
    readPart: "Читати цю частину вголос",
    openInBook: "Відкрити в книзі",
    stopSpeech: "Зупинити",
    speakFailed: "Не вдалося прочитати речення.",
    wordHint: "Торкніться слова, щоб відкрити словник.",
    syncFailed: "Не вдалося синхронізувати збережені слова.",
    signInBenefit: "Увійдіть, щоб синхронізувати слова між пристроєм і сайтом.",
    signInWithGoogle: "Увійти через Google",
    googleNotConfigured: "Вхід через Google ще не налаштовано.",
    googleSignInFailed: "Не вдалося почати вхід через Google.",
    signOut: "Вийти",
    account: "Обліковий запис",
    sessionCheckFailed: "Не вдалося перевірити вхід.",
    downloadBook: "Зберегти на пристрій",
    downloading: "Завантажуємо…",
    downloadFailed: "Не вдалося завантажити книгу.",
    savedOffline: "Збережено для читання без мережі",
    open: "Відкрити",
    partOf: "Частина {n} з {m}",
    nextPartNamed: "Наступна частина: {title}",
    finishedBook: "Це кінець книги.",
    readingSize: "Розмір тексту",
    readingFont: "Шрифт",
    readingPaper: "Тло",
    fontLiterary: "Literata",
    fontPlain: "Системний",
    fontClassic: "Класичний",
    paperAuto: "Авто",
    paperLagoon: "Лагуна",
    paperIvory: "Слонова кістка",
    paperNight: "Ніч",
    sizeSmall: "Малий",
    sizeRegular: "Звичайний",
    sizeLarge: "Великий",
    close: "Закрити",
    back: "Назад",
    menu: "Інші дії",
    readingSettings: "Налаштування читання",
    practice: "Практика",
    showAnswer: "Показати відповідь",
    againCard: "Ще раз",
    knowCard: "Знаю",
    practiceSummary: "Карток: {cards}. Потрібна ще спроба: {again}.",
    practiceMissed: "Повторити пропущені",
    practiceLeave: "Закрити",
    practiceLeft: "Залишилося: {count}",
    partStudy: "Ви відкрили перекладів: {translations}. Зберегли слів: {words}.",
    parts: "Частини",
    part: "Частина {n}",
    sentenceLabel: "Речення {n}",
    partOne: "частина",
    partFew: "частини",
    partMany: "частин",
    language: autonyms,
  },
  ru: {
    appName: "2books",
    books: "Книги",
    read: "Читать",
    previousPart: "Предыдущая часть",
    nextPart: "Следующая часть",
    translation: "Перевод",
    hint: "Нажмите на предложение, чтобы увидеть перевод.",
    sentenceHint: "Нажмите дважды, чтобы показать перевод",
    noTranslation: "Перевода этого предложения ещё нет.",
    interfaceLanguage: "Язык интерфейса",
    nativeLanguage: "Язык перевода",
    loading: "Загрузка…",
    loadError: "Не удалось это загрузить.",
    retry: "Попробовать снова",
    emptyCatalog: "В каталоге пока нет книг.",
    emptyBook: "В этой книге пока нет частей.",
    importBook: "Добавить книгу из файла",
    importing: "Читаем файл…",
    importInvalid: "Этот файл не является книгой .2books, которую можно открыть.",
    importReserved: "Эта книга уже есть в каталоге. Файл не сохранён.",
    importFailed: "Не удалось сохранить книгу на устройстве.",
    onThisPhone: "На этом устройстве",
    library: "Библиотека",
    continueReading: "Продолжить чтение",
    settings: "Настройки",
    deleteBook: "Удалить с устройства",
    deleteConfirmTitle: "Удалить эту книгу с устройства?",
    deleteConfirmBody: "Файл и место чтения будут стёрты. Книгу из каталога это не затронет.",
    cancel: "Отмена",
    catalogUnavailable: "Каталог сейчас недоступен. Книги на устройстве остаются.",
    dismiss: "Скрыть перевод",
    dictionary: "Словарь",
    noDictionaryEntry: "В словаре нет этого слова.",
    savedWords: "Сохранённые слова",
    saveWord: "Сохранить слово",
    savedWord: "Сохранено",
    removeWord: "Убрать",
    wordsEmpty: "Вы ещё не сохранили ни одного слова.",
    wordsSearch: "Искать слова",
    wordsOther: "Пока нет слов для языка «{language}». Для языка «{other}» сохранено {count}.",
    switchLanguage: "Показать эти слова",
    exportAnki: "Экспорт в Anki",
    ankiHint: "Откройте этот файл в Anki через Импорт.",
    exportedCount: "Экспортировано слов: {count}.",
    savedCount: "Сохранено: {count}",
    shareFailed: "Не удалось поделиться списком.",
    undo: "Вернуть",
    wordRemoved: "Слово убрано",
    textEnglish: "По-английски",
    textUkrainian: "По-украински",
    textRussian: "По-русски",
    translateWord: "Перевести",
    translating: "Переводим…",
    translateFailed: "Не удалось перевести это слово.",
    translateExplain:
      "Ключ Google Переводчика остаётся на этом устройстве и переводит слова здесь. Можно также открыть Google Переводчик в браузере.",
    addKeyHere: "Добавить ключ, чтобы переводить здесь",
    openInGoogle: "Открыть в Google Переводчике",
    googleKeyLabel: "Ключ Google Переводчика",
    googleKeyHint: "Ключ остаётся только на этом устройстве. 2books его не получает.",
    googleKeyPurpose: "Ключ переводит слова в книге на этом устройстве.",
    googleKeyPlaceholder: "Вставьте ключ",
    googleKeyHow: "Как получить ключ",
    googleKeyShow: "Показать ключ",
    googleKeyHide: "Скрыть ключ",
    googleKeySaved: "Ключ сохранён на этом устройстве.",
    googleKeySave: "Сохранить ключ",
    googleKeyClear: "Удалить ключ",
    googleKeyTooLong: "Этот ключ слишком длинный.",
    googleKeySaveFailed: "Не удалось сохранить ключ. Попробуйте снова.",
    googleKeyClearTitle: "Удалить ключ перевода?",
    googleKeyClearBody: "Перевод слов на этом устройстве остановится, пока вы снова не добавите ключ.",
    googleKeyRemoved: "Ключ удалён с этого устройства.",
    listenSentence: "Прослушать предложение",
    readPart: "Читать эту часть вслух",
    openInBook: "Открыть в книге",
    stopSpeech: "Остановить",
    speakFailed: "Не удалось прочитать предложение.",
    wordHint: "Коснитесь слова, чтобы открыть словарь.",
    syncFailed: "Не удалось синхронизировать сохранённые слова.",
    signInBenefit: "Войдите, чтобы синхронизировать слова между устройством и сайтом.",
    signInWithGoogle: "Войти через Google",
    googleNotConfigured: "Вход через Google ещё не настроен.",
    googleSignInFailed: "Не удалось начать вход через Google.",
    signOut: "Выйти",
    account: "Учётная запись",
    sessionCheckFailed: "Не удалось проверить вход.",
    downloadBook: "Сохранить на устройство",
    downloading: "Скачиваем…",
    downloadFailed: "Не удалось скачать книгу.",
    savedOffline: "Сохранено для чтения без сети",
    open: "Открыть",
    partOf: "Часть {n} из {m}",
    nextPartNamed: "Следующая часть: {title}",
    finishedBook: "Это конец книги.",
    readingSize: "Размер текста",
    readingFont: "Шрифт",
    readingPaper: "Фон",
    fontLiterary: "Literata",
    fontPlain: "Системный",
    fontClassic: "Классический",
    paperAuto: "Авто",
    paperLagoon: "Лагуна",
    paperIvory: "Слоновая кость",
    paperNight: "Ночь",
    sizeSmall: "Малый",
    sizeRegular: "Обычный",
    sizeLarge: "Крупный",
    close: "Закрыть",
    back: "Назад",
    menu: "Другие действия",
    readingSettings: "Настройки чтения",
    practice: "Практика",
    showAnswer: "Показать ответ",
    againCard: "Ещё раз",
    knowCard: "Знаю",
    practiceSummary: "Карточек: {cards}. Нужна ещё попытка: {again}.",
    practiceMissed: "Повторить пропущенные",
    practiceLeave: "Закрыть",
    practiceLeft: "Осталось: {count}",
    partStudy: "Вы открыли переводов: {translations}. Сохранили слов: {words}.",
    parts: "Части",
    part: "Часть {n}",
    sentenceLabel: "Предложение {n}",
    partOne: "часть",
    partFew: "части",
    partMany: "частей",
    language: autonyms,
  },
  en: {
    appName: "2books",
    books: "Books",
    read: "Read",
    previousPart: "Previous part",
    nextPart: "Next part",
    translation: "Translation",
    hint: "Tap a sentence to see its translation.",
    sentenceHint: "Double tap to show the translation",
    noTranslation: "This sentence has no translation yet.",
    interfaceLanguage: "Interface language",
    nativeLanguage: "Translation language",
    loading: "Loading…",
    loadError: "This could not be loaded.",
    retry: "Try again",
    emptyCatalog: "No books yet.",
    emptyBook: "This book has no parts yet.",
    importBook: "Add a book from a file",
    importing: "Reading the file…",
    importInvalid: "This file is not a .2books book that can be opened.",
    importReserved: "This book is already in the catalog. The file was not saved.",
    importFailed: "Could not save the book on this device.",
    onThisPhone: "On this device",
    library: "Library",
    continueReading: "Continue reading",
    settings: "Settings",
    deleteBook: "Delete from this device",
    deleteConfirmTitle: "Delete this book from this device?",
    deleteConfirmBody:
      "The file and the reading position will be erased. Catalog books are not affected.",
    cancel: "Cancel",
    catalogUnavailable: "The catalog is unavailable. Books on this device are still here.",
    dismiss: "Hide translation",
    dictionary: "Dictionary",
    noDictionaryEntry: "This word is not in the dictionary.",
    savedWords: "Saved words",
    saveWord: "Save word",
    savedWord: "Saved",
    removeWord: "Remove",
    wordsEmpty: "You have not saved any words yet.",
    wordsSearch: "Search words",
    wordsOther: "No words for {language} yet. {count} saved for {other}.",
    switchLanguage: "Show those words",
    exportAnki: "Export to Anki",
    ankiHint: "Open this file in Anki with Import.",
    exportedCount: "Exported {count} words.",
    savedCount: "{count} saved",
    shareFailed: "Could not share this list.",
    undo: "Undo",
    wordRemoved: "Word removed",
    textEnglish: "In English",
    textUkrainian: "In Ukrainian",
    textRussian: "In Russian",
    translateWord: "Translate",
    translating: "Translating…",
    translateFailed: "Could not translate this word.",
    translateExplain:
      "A Google Translate key stays on this device and translates words here. You can also open Google Translate in the browser.",
    addKeyHere: "Add a key to translate here",
    openInGoogle: "Open in Google Translate",
    googleKeyLabel: "Google Translate key",
    googleKeyHint: "The key stays on this device only. 2books never receives it.",
    googleKeyPurpose: "The key translates words in the book, on this device.",
    googleKeyPlaceholder: "Paste the key",
    googleKeyHow: "How to get a key",
    googleKeyShow: "Show key",
    googleKeyHide: "Hide key",
    googleKeySaved: "A key is saved on this device.",
    googleKeySave: "Save key",
    googleKeyClear: "Remove key",
    googleKeyTooLong: "That key is too long.",
    googleKeySaveFailed: "Could not save the key. Try again.",
    googleKeyClearTitle: "Remove the translation key?",
    googleKeyClearBody: "Word translation on this device will stop until you add a key again.",
    googleKeyRemoved: "The key was removed from this device.",
    listenSentence: "Listen",
    readPart: "Read this part aloud",
    openInBook: "Open in the book",
    stopSpeech: "Stop",
    speakFailed: "Could not read this sentence.",
    wordHint: "Tap a word for the dictionary.",
    syncFailed: "Could not sync saved words.",
    signInBenefit: "Sign in to sync words between this device and the website.",
    signInWithGoogle: "Sign in with Google",
    googleNotConfigured: "Google sign-in is not configured yet.",
    googleSignInFailed: "Could not start Google sign-in.",
    signOut: "Sign out",
    account: "Account",
    sessionCheckFailed: "Could not check sign-in.",
    downloadBook: "Save to this device",
    downloading: "Downloading…",
    downloadFailed: "Could not download this book.",
    savedOffline: "Saved for offline reading",
    open: "Open",
    partOf: "Part {n} of {m}",
    nextPartNamed: "Next part: {title}",
    finishedBook: "This is the end of the book.",
    readingSize: "Text size",
    readingFont: "Typeface",
    readingPaper: "Paper",
    fontLiterary: "Literata",
    fontPlain: "System",
    fontClassic: "Classic",
    paperAuto: "Auto",
    paperLagoon: "Lagoon",
    paperIvory: "Ivory",
    paperNight: "Night",
    sizeSmall: "Small",
    sizeRegular: "Regular",
    sizeLarge: "Large",
    close: "Close",
    back: "Back",
    menu: "More actions",
    readingSettings: "Reading settings",
    practice: "Practice",
    showAnswer: "Show the answer",
    againCard: "Again",
    knowCard: "Know it",
    practiceSummary: "{cards} cards. {again} needed another try.",
    practiceMissed: "Practice the missed ones",
    practiceLeave: "Leave",
    practiceLeft: "{count} left",
    partStudy: "You opened {translations} translations and saved {words} words.",
    parts: "Parts",
    part: "Part {n}",
    sentenceLabel: "Sentence {n}",
    partOne: "part",
    partFew: "parts",
    partMany: "parts",
    language: autonyms,
  },
} satisfies Record<Locale, Catalog>;

export function message(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}

export function languageName(_locale: Locale, language: Locale): string {
  return autonyms[language];
}

export function partLabel(locale: Locale, n: number): string {
  return catalogs[locale].part.replaceAll("{n}", String(n));
}

export function sentenceLabel(locale: Locale, n: number): string {
  return catalogs[locale].sentenceLabel.replaceAll("{n}", String(n));
}

export function partProgress(locale: Locale, n: number, total: number): string {
  return message(locale, "partOf")
    .replaceAll("{n}", String(n))
    .replaceAll("{m}", String(total));
}

export function nextPartTitle(locale: Locale, title: string): string {
  return message(locale, "nextPartNamed").replaceAll("{title}", title);
}

export function savedCountLabel(locale: Locale, count: number): string {
  return message(locale, "savedCount").replaceAll("{count}", String(count));
}

export function practiceSummaryLine(locale: Locale, cards: number, again: number): string {
  return message(locale, "practiceSummary")
    .replaceAll("{cards}", String(cards))
    .replaceAll("{again}", String(again));
}

export function practiceLeftLine(locale: Locale, count: number): string {
  return message(locale, "practiceLeft").replaceAll("{count}", String(count));
}

export function partStudyLine(locale: Locale, translations: number, words: number): string {
  return message(locale, "partStudy")
    .replaceAll("{translations}", String(translations))
    .replaceAll("{words}", String(words));
}

export function exportedCountLabel(locale: Locale, count: number): string {
  return message(locale, "exportedCount").replaceAll("{count}", String(count));
}

export function wordsOtherLine(
  locale: Locale,
  language: string,
  other: string,
  count: number,
): string {
  return message(locale, "wordsOther")
    .replaceAll("{language}", language)
    .replaceAll("{other}", other)
    .replaceAll("{count}", String(count));
}

export function chapterCountLabel(locale: Locale, count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (locale === "en") {
    return n === 1 ? `${n} ${catalogs.en.partOne}` : `${n} ${catalogs.en.partMany}`;
  }
  const catalog = catalogs[locale];
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${catalog.partOne}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${catalog.partFew}`;
  return `${n} ${catalog.partMany}`;
}
