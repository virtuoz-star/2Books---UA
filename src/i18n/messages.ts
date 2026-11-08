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
  | "signInWithGoogle"
  | "googleNotConfigured"
  | "googleSignInFailed"
  | "signOut"
  | "email"
  | "uploadTitle"
  | "uploadAction"
  | "uploadHint"
  | "noTranslation"
  | "dictionary"
  | "noDictionaryEntry"
  | "myBooks"
  | "alignmentPending"
  | "invalidInput"
  | "anonymous"
  | "tooLong"
  | "adminLink"
  | "adminTitle"
  | "usersHeading"
  | "uploadsHeading"
  | "catalogNote"
  | "addCatalogBook"
  | "catalogAddress"
  | "catalogAddressHint"
  | "authorLabel"
  | "bookTitle"
  | "chapterTitle"
  | "textEnglish"
  | "textUkrainian"
  | "textRussian"
  | "linesHint"
  | "importFile"
  | "importHint"
  | "importFailed"
  | "addChapter"
  | "removeChapter"
  | "addSentence"
  | "removeSentence"
  | "publishBook"
  | "invalidCatalog"
  | "reservedId"
  | "duplicateBook"
  | "bundledBook"
  | "deleteCatalogBook"
  | "roleLabel"
  | "roleAdmin"
  | "roleUser"
  | "statusBanned"
  | "statusActive"
  | "blockUser"
  | "unblockUser"
  | "deleteUser"
  | "deleteBook"
  | "confirmDelete"
  | "cancelAction"
  | "ownerLabel"
  | "sentencesLabel"
  | "chaptersLabel"
  | "createdLabel"
  | "youLabel"
  | "lastAdmin"
  | "noUsers"
  | "noUploads"
  | "actionFailed";

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
    signInWithGoogle: "Увійти через Google",
    googleNotConfigured: "Вхід через Google ще не налаштовано.",
    googleSignInFailed: "Не вдалося почати вхід через Google.",
    signOut: "Вийти",
    email: "Електронна пошта",
    uploadTitle: "Додати свій текст",
    uploadAction: "Зберегти текст",
    uploadHint: "Вставте текст англійською. Переклад з’явиться після вирівнювання.",
    noTranslation: "Перекладу цього речення ще немає.",
    dictionary: "Словник",
    noDictionaryEntry: "У словнику немає цього слова.",
    myBooks: "Мої тексти",
    alignmentPending: "Переклад ще не готовий",
    invalidInput: "Перевірте назву й текст.",
    anonymous: "Увійдіть, щоб зберегти текст.",
    tooLong: "Текст задовгий.",
    adminLink: "Керування",
    adminTitle: "Керування",
    usersHeading: "Користувачі",
    uploadsHeading: "Завантажені тексти",
    catalogNote: "Вбудовані книги лишаються в застосунку. Додані книги бачать усі читачі.",
    addCatalogBook: "Додати книгу",
    catalogAddress: "Адреса",
    catalogAddressHint: "Латиниця, цифри й дефіси. Наприклад, winter-note.",
    authorLabel: "Автор",
    bookTitle: "Назва книги",
    chapterTitle: "Назва частини",
    textEnglish: "Англійською",
    textUkrainian: "Українською",
    textRussian: "Російською",
    linesHint: "Кожне речення — з нового рядка. Кількість рядків у трьох мовах має збігатися.",
    importFile: "Імпортувати файл .2books",
    importHint: "Файл містить англійський текст і український або російський переклад.",
    importFailed: "Не вдалося прочитати цей файл.",
    addChapter: "Додати частину",
    removeChapter: "Прибрати частину",
    addSentence: "Додати речення",
    removeSentence: "Прибрати речення",
    publishBook: "Опублікувати",
    invalidCatalog: "Перевірте адресу, назви й усі три мови речень.",
    reservedId: "Цю адресу зайнято вбудованою книгою.",
    duplicateBook: "Книга з такою адресою вже є.",
    bundledBook: "Вбудована",
    deleteCatalogBook: "Видалити книгу",
    roleLabel: "Роль",
    roleAdmin: "Адміністратор",
    roleUser: "Читач",
    statusBanned: "Заблоковано",
    statusActive: "Активний",
    blockUser: "Заблокувати",
    unblockUser: "Розблокувати",
    deleteUser: "Видалити користувача",
    deleteBook: "Видалити текст",
    confirmDelete: "Видалити безповоротно?",
    cancelAction: "Скасувати",
    ownerLabel: "Власник",
    sentencesLabel: "Речення",
    chaptersLabel: "Частини",
    createdLabel: "Створено",
    youLabel: "це ви",
    lastAdmin: "Останнього адміністратора не можна зняти.",
    noUsers: "Користувачів ще немає.",
    noUploads: "Завантажених текстів ще немає.",
    actionFailed: "Дію не виконано.",
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
    signInWithGoogle: "Войти через Google",
    googleNotConfigured: "Вход через Google ещё не настроен.",
    googleSignInFailed: "Не удалось начать вход через Google.",
    signOut: "Выйти",
    email: "Эл. почта",
    uploadTitle: "Добавить свой текст",
    uploadAction: "Сохранить текст",
    uploadHint: "Вставьте английский текст. Перевод появится после выравнивания.",
    noTranslation: "Перевода этого предложения ещё нет.",
    dictionary: "Словарь",
    noDictionaryEntry: "В словаре нет этого слова.",
    myBooks: "Мои тексты",
    alignmentPending: "Перевод ещё не готов",
    invalidInput: "Проверьте название и текст.",
    anonymous: "Войдите, чтобы сохранить текст.",
    tooLong: "Текст слишком длинный.",
    adminLink: "Управление",
    adminTitle: "Управление",
    usersHeading: "Пользователи",
    uploadsHeading: "Загруженные тексты",
    catalogNote: "Встроенные книги остаются в приложении. Добавленные книги видят все читатели.",
    addCatalogBook: "Добавить книгу",
    catalogAddress: "Адрес",
    catalogAddressHint: "Латиница, цифры и дефисы. Например, winter-note.",
    authorLabel: "Автор",
    bookTitle: "Название книги",
    chapterTitle: "Название части",
    textEnglish: "По-английски",
    textUkrainian: "По-украински",
    textRussian: "По-русски",
    linesHint: "Каждое предложение — с новой строки. Число строк в трёх языках должно совпадать.",
    importFile: "Импортировать файл .2books",
    importHint: "Файл содержит английский текст и украинский или русский перевод.",
    importFailed: "Не удалось прочитать этот файл.",
    addChapter: "Добавить часть",
    removeChapter: "Убрать часть",
    addSentence: "Добавить предложение",
    removeSentence: "Убрать предложение",
    publishBook: "Опубликовать",
    invalidCatalog: "Проверьте адрес, названия и все три языка предложений.",
    reservedId: "Этот адрес занят встроенной книгой.",
    duplicateBook: "Книга с таким адресом уже есть.",
    bundledBook: "Встроенная",
    deleteCatalogBook: "Удалить книгу",
    roleLabel: "Роль",
    roleAdmin: "Администратор",
    roleUser: "Читатель",
    statusBanned: "Заблокирован",
    statusActive: "Активен",
    blockUser: "Заблокировать",
    unblockUser: "Разблокировать",
    deleteUser: "Удалить пользователя",
    deleteBook: "Удалить текст",
    confirmDelete: "Удалить безвозвратно?",
    cancelAction: "Отмена",
    ownerLabel: "Владелец",
    sentencesLabel: "Предложения",
    chaptersLabel: "Части",
    createdLabel: "Создано",
    youLabel: "это вы",
    lastAdmin: "Последнего администратора нельзя снять.",
    noUsers: "Пользователей ещё нет.",
    noUploads: "Загруженных текстов ещё нет.",
    actionFailed: "Действие не выполнено.",
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
    signInWithGoogle: "Continue with Google",
    googleNotConfigured: "Google sign-in is not configured yet.",
    googleSignInFailed: "Could not start Google sign-in.",
    signOut: "Sign out",
    email: "Email",
    uploadTitle: "Add your text",
    uploadAction: "Save text",
    uploadHint: "Paste English text. A translation appears after alignment.",
    noTranslation: "This sentence has no translation yet.",
    dictionary: "Dictionary",
    noDictionaryEntry: "This word is not in the dictionary.",
    myBooks: "My texts",
    alignmentPending: "Translation is not ready yet",
    invalidInput: "Check the title and the text.",
    anonymous: "Sign in to save a text.",
    tooLong: "That text is too long.",
    adminLink: "Admin",
    adminTitle: "Admin",
    usersHeading: "Users",
    uploadsHeading: "Uploaded texts",
    catalogNote: "Bundled books stay in the app. Added books are public.",
    addCatalogBook: "Add a book",
    catalogAddress: "Address",
    catalogAddressHint: "Letters, numbers, and hyphens. For example, winter-note.",
    authorLabel: "Author",
    bookTitle: "Book title",
    chapterTitle: "Part title",
    textEnglish: "In English",
    textUkrainian: "In Ukrainian",
    textRussian: "In Russian",
    linesHint: "Put one sentence on each line. All three languages need the same number of lines.",
    importFile: "Import a .2books file",
    importHint: "The file contains English text and a Ukrainian or Russian translation.",
    importFailed: "This file could not be read.",
    addChapter: "Add a part",
    removeChapter: "Remove part",
    addSentence: "Add a sentence",
    removeSentence: "Remove sentence",
    publishBook: "Publish",
    invalidCatalog: "Check the address, the titles, and all three sentence languages.",
    reservedId: "That address belongs to a bundled book.",
    duplicateBook: "A book with that address already exists.",
    bundledBook: "Bundled",
    deleteCatalogBook: "Delete book",
    roleLabel: "Role",
    roleAdmin: "Admin",
    roleUser: "Reader",
    statusBanned: "Blocked",
    statusActive: "Active",
    blockUser: "Block",
    unblockUser: "Unblock",
    deleteUser: "Delete user",
    deleteBook: "Delete text",
    confirmDelete: "Delete this permanently?",
    cancelAction: "Cancel",
    ownerLabel: "Owner",
    sentencesLabel: "Sentences",
    chaptersLabel: "Parts",
    createdLabel: "Created",
    youLabel: "you",
    lastAdmin: "The last administrator must stay.",
    noUsers: "No users yet.",
    noUploads: "No uploaded texts yet.",
    actionFailed: "That action did not complete.",
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
