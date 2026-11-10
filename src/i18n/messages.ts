import type { Locale } from "#/i18n/types";

export type MessageKey =
  | "appName"
  | "interfaceLanguage"
  | "nativeLanguage"
  | "readingPreferences"
  | "readingFont"
  | "fontLiterary"
  | "fontPlain"
  | "fontClassic"
  | "readingSize"
  | "sizeSmall"
  | "sizeRegular"
  | "sizeLarge"
  | "readingPaper"
  | "paperLagoon"
  | "paperIvory"
  | "paperNight"
  | "paperAuto"
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
  | "uploadTitle"
  | "uploadTitleLabel"
  | "uploadTextLabel"
  | "uploadAction"
  | "uploadSaving"
  | "uploadSaveFailed"
  | "uploadHint"
  | "noTranslation"
  | "dictionary"
  | "noDictionaryEntry"
  | "savedWords"
  | "saveWord"
  | "savedWord"
  | "removeWord"
  | "wordsEmpty"
  | "exportAnki"
  | "ankiHint"
  | "downloadBook"
  | "myBooks"
  | "alignmentPending"
  | "invalidInput"
  | "anonymous"
  | "tooLong"
  | "uploadQuota"
  | "uploadRate"
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
  | "translateWord"
  | "translating"
  | "translateFailed"
  | "googleKeyLabel"
  | "googleKeyHint"
  | "googleKeySaved"
  | "googleKeySave"
  | "googleKeyClear"
  | "googleKeyTooLong"
  | "listenSentence"
  | "readPart"
  | "openInBook"
  | "stopSpeech"
  | "speakFailed"
  | "translateBook"
  | "translateBookAgain"
  | "translateBookNeedKey"
  | "translateBookSaved"
  | "translateBookPending"
  | "translateBookNone"
  | "syncFailed"
  | "actionFailed"
  | "navLibrary"
  | "navWords"
  | "navAdd"
  | "navAccount"
  | "skipToText"
  | "navMain"
  | "navParts"
  | "notFoundTitle"
  | "notFoundBody"
  | "errorTitle"
  | "errorBody"
  | "backToBooks"
  | "retryAction"
  | "hintDismiss"
  | "openInGoogle"
  | "translateNeedsKey"
  | "addGoogleKey"
  | "wordSavedStatus"
  | "wordRemovedStatus"
  | "couldNotSave"
  | "signOutConfirm"
  | "translationMode"
  | "modeSide"
  | "modeTap"
  | "modeBlur"
  | "shortcuts"
  | "closePanel"
  | "loading"
  | "contents"
  | "appDescription"
  | "partNoTranslation"
  | "bookFinished"
  | "wordsLead"
  | "wordsSearch"
  | "wordsRecent"
  | "wordsAlpha"
  | "wordsOther"
  | "switchLanguage"
  | "readABook"
  | "undoAction"
  | "googleKeyHelp"
  | "googleKeyReplace"
  | "googleKeyTest"
  | "googleKeyWorks"
  | "googleKeyRejected"
  | "practice"
  | "practiceShow"
  | "practiceAgain"
  | "practiceKnow"
  | "practiceMissed"
  | "practiceLeave"
  | "signInPlace"
  | "signInWords"
  | "signInTexts"
  | "signInPrivacy"
  | "signInRedirecting"
  | "myTextsEmpty"
  | "renameBook"
  | "deleteText"
  | "libraryFailed"
  | "confirmDeletePermanent"
  | "importAction"
  | "listedAdmin"
  | "loadMore"
  | "searchUsers"
  | "roleConfirm"
  | "translateKeyRejected"
  | "translateQuota"
  | "preparingTranslation"
  | "addTextTile"
  | "filterLanguage";

type Catalog = Record<MessageKey | "sentenceLabel", string> & {
  language: Record<Locale, string>;
};

const catalogs = {
  uk: {
    appName: "2books",
    interfaceLanguage: "Мова інтерфейсу",
    nativeLanguage: "Мова перекладу",
    readingPreferences: "Вигляд тексту",
    readingFont: "Шрифт",
    fontLiterary: "Літературний",
    fontPlain: "Простий",
    fontClassic: "Класичний",
    readingSize: "Розмір",
    sizeSmall: "Малий",
    sizeRegular: "Звичайний",
    sizeLarge: "Великий",
    readingPaper: "Тло",
    paperLagoon: "Лагуна",
    paperIvory: "Слонова кістка",
    paperNight: "Ніч",
    paperAuto: "Авто",
    hint: "Торкніться речення, щоб побачити переклад. Торкніться слова — відкриється словник.",
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
    googleNotConfigured: "Вхід через Google ще не налаштовано. Це повідомлення для власника сайту.",
    googleSignInFailed: "Не вдалося увійти через Google. Спробуйте ще раз.",
    signOut: "Вийти",
    uploadTitle: "Додати свій текст",
    uploadTitleLabel: "Назва",
    uploadTextLabel: "Текст англійською",
    uploadAction: "Зберегти текст",
    uploadSaving: "Зберігаємо…",
    uploadSaveFailed: "Не вдалося зберегти текст. Спробуйте ще раз.",
    uploadHint:
      "До 200 речень або 100 000 знаків. Після збереження текст можна перекласти власним ключем Google Перекладача.",
    noTranslation: "Перекладу цього речення ще немає.",
    dictionary: "Словник",
    noDictionaryEntry: "Немає у словнику",
    savedWords: "Збережені слова",
    saveWord: "Зберегти слово",
    savedWord: "Збережено",
    removeWord: "Прибрати зі збережених",
    wordsEmpty: "Ви ще не зберегли жодного слова.",
    exportAnki: "Експорт в Anki",
    ankiHint: "Відкрийте завантажений файл в Anki: Файл → Імпортувати.",
    downloadBook: "Завантажити для телефона (.2books)",
    myBooks: "Мої тексти",
    alignmentPending: "Ще не перекладено",
    invalidInput: "Додайте назву (до 120 знаків) і текст.",
    anonymous: "Увійдіть, щоб зберегти текст.",
    tooLong: "Текст задовгий: щонайбільше 200 речень або 100 000 знаків.",
    uploadQuota: "Можна зберегти щонайбільше 50 текстів.",
    uploadRate: "Можна додати щонайбільше 20 текстів за годину.",
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
    statusBanned: "Заблокований",
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
    translateWord: "Перекласти",
    translating: "Перекладаємо…",
    translateFailed: "Не вдалося перекласти це слово.",
    googleKeyLabel: "Ключ Google Перекладача",
    googleKeyHint: "Потрібен ключ Cloud Translation API з Google Cloud Console. Google може стягувати плату.",
    googleKeySaved: "Ключ збережено на цьому пристрої.",
    googleKeySave: "Зберегти ключ",
    googleKeyClear: "Стерти ключ",
    googleKeyTooLong: "Цей ключ задовгий.",
    listenSentence: "Прослухати речення",
    readPart: "Читати цю частину вголос",
    openInBook: "Відкрити в книзі",
    stopSpeech: "Зупинити",
    speakFailed: "Не вдалося озвучити речення.",
    translateBook: "Перекласти цей текст",
    translateBookAgain: "Перекласти ще раз",
    translateBookNeedKey: "Додайте ключ Google Перекладача в налаштуваннях.",
    translateBookSaved: "Переклад збережено.",
    translateBookPending: "Перекладено не все. Натисніть «Перекласти цей текст» ще раз.",
    translateBookNone: "Жодне речення не збережено.",
    syncFailed: "Не вдалося синхронізувати збережені слова.",
    actionFailed: "Дію не виконано.",
    navLibrary: "Книги",
    navWords: "Слова",
    navAdd: "Додати текст",
    navAccount: "Обліковий запис",
    skipToText: "Перейти до тексту",
    navMain: "Основна навігація",
    navParts: "Частини",
    notFoundTitle: "Сторінку не знайдено",
    notFoundBody: "Такої сторінки немає.",
    errorTitle: "Щось пішло не так",
    errorBody: "Щось пішло не так. Спробуйте ще раз.",
    backToBooks: "До книг",
    retryAction: "Спробувати ще раз",
    hintDismiss: "Зрозуміло",
    openInGoogle: "Відкрити в Google Перекладачі",
    translateNeedsKey: "Вбудований переклад потребує ключа Google.",
    addGoogleKey: "Додати ключ",
    wordSavedStatus: "Слово збережено",
    wordRemovedStatus: "Слово прибрано",
    couldNotSave: "Не вдалося зберегти на цьому пристрої.",
    signOutConfirm: "Видалити збережені слова і ключ Google з цього пристрою?",
    translationMode: "Переклад на сторінці",
    modeSide: "Поруч",
    modeTap: "На дотик",
    modeBlur: "Розмито до наведення",
    shortcuts: "L — прослухати, S — зберегти",
    closePanel: "Закрити",
    loading: "Завантаження…",
    contents: "Зміст",
    appDescription: "Читайте англійською, а переклад тримайте поруч.",
    partNoTranslation: "Перекладу цього тексту ще немає.",
    bookFinished: "Цю книгу дочитано.",
    wordsLead: "Слова, які ви зберегли під час читання, разом із реченням.",
    wordsSearch: "Пошук",
    wordsRecent: "Спочатку нові",
    wordsAlpha: "За алфавітом",
    wordsOther: "Слова збережено іншою мовою перекладу.",
    switchLanguage: "Показати їх",
    readABook: "Читати книгу",
    undoAction: "Скасувати",
    googleKeyHelp: "Ключ відкриває переклад ваших текстів і слів, яких немає в словнику.",
    googleKeyReplace: "Замінити",
    googleKeyTest: "Перевірити ключ",
    googleKeyWorks: "Ключ працює.",
    googleKeyRejected: "Google відхилив ключ.",
    practice: "Практика",
    practiceShow: "Показати відповідь",
    practiceAgain: "Ще раз",
    practiceKnow: "Знаю",
    practiceMissed: "Повторити пропущені",
    practiceLeave: "Закрити",
    signInPlace: "Місце в кожній книзі на кожному пристрої.",
    signInWords: "Збережені слова синхронізуються.",
    signInTexts: "Власні тексти лишаються в обліковому записі.",
    signInPrivacy: "Слова з цього пристрою зберігаються і зливаються з обліковим записом.",
    signInRedirecting: "Переходимо до Google…",
    myTextsEmpty: "Тут з’являться тексти, які ви додасте.",
    renameBook: "Перейменувати",
    deleteText: "Видалити текст",
    libraryFailed: "Не вдалося завантажити бібліотеку.",
    confirmDeletePermanent: "Так, видалити назавжди",
    importAction: "Імпортувати",
    listedAdmin: "Цю адресу задано в ADMIN_EMAILS. Роль змінюється лише після того, як адресу приберуть зі списку.",
    loadMore: "Ще",
    searchUsers: "Пошук за ім’ям або поштою",
    roleConfirm: "Змінити роль?",
    translateKeyRejected: "Google відхилив ключ. Перевірте його в налаштуваннях.",
    translateQuota: "Ліміт Google вичерпано. Спробуйте пізніше.",
    preparingTranslation: "Готуємо переклад…",
    addTextTile: "Додати свій текст",
    filterLanguage: "Моя мова перекладу",
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
    readingPreferences: "Вид текста",
    readingFont: "Шрифт",
    fontLiterary: "Литературный",
    fontPlain: "Простой",
    fontClassic: "Классический",
    readingSize: "Размер",
    sizeSmall: "Малый",
    sizeRegular: "Обычный",
    sizeLarge: "Большой",
    readingPaper: "Фон",
    paperLagoon: "Лагуна",
    paperIvory: "Слоновая кость",
    paperNight: "Ночь",
    paperAuto: "Авто",
    hint: "Нажмите на предложение, чтобы увидеть перевод. Нажмите на слово — откроется словарь.",
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
    googleNotConfigured: "Вход через Google ещё не настроен. Это сообщение для владельца сайта.",
    googleSignInFailed: "Не удалось войти через Google. Попробуйте ещё раз.",
    signOut: "Выйти",
    uploadTitle: "Добавить свой текст",
    uploadTitleLabel: "Название",
    uploadTextLabel: "Текст на английском",
    uploadAction: "Сохранить текст",
    uploadSaving: "Сохраняем…",
    uploadSaveFailed: "Не удалось сохранить текст. Попробуйте ещё раз.",
    uploadHint:
      "До 200 предложений или 100 000 знаков. После сохранения текст можно перевести своим ключом Google Переводчика.",
    noTranslation: "Перевода этого предложения ещё нет.",
    dictionary: "Словарь",
    noDictionaryEntry: "Нет в словаре",
    savedWords: "Сохранённые слова",
    saveWord: "Сохранить слово",
    savedWord: "Сохранено",
    removeWord: "Убрать из сохранённых",
    wordsEmpty: "Вы ещё не сохранили ни одного слова.",
    exportAnki: "Экспорт в Anki",
    ankiHint: "Откройте скачанный файл в Anki: Файл → Импортировать.",
    downloadBook: "Скачать для телефона (.2books)",
    myBooks: "Мои тексты",
    alignmentPending: "Ещё не переведён",
    invalidInput: "Добавьте название (до 120 знаков) и текст.",
    anonymous: "Войдите, чтобы сохранить текст.",
    tooLong: "Текст слишком длинный: не больше 200 предложений или 100 000 знаков.",
    uploadQuota: "Можно сохранить не больше 50 текстов.",
    uploadRate: "Можно добавить не больше 20 текстов за час.",
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
    translateWord: "Перевести",
    translating: "Переводим…",
    translateFailed: "Не удалось перевести это слово.",
    googleKeyLabel: "Ключ Google Переводчика",
    googleKeyHint: "Нужен ключ Cloud Translation API из Google Cloud Console. Google может брать плату.",
    googleKeySaved: "Ключ сохранён на этом устройстве.",
    googleKeySave: "Сохранить ключ",
    googleKeyClear: "Стереть ключ",
    googleKeyTooLong: "Этот ключ слишком длинный.",
    listenSentence: "Прослушать предложение",
    readPart: "Читать эту часть вслух",
    openInBook: "Открыть в книге",
    stopSpeech: "Остановить",
    speakFailed: "Не удалось озвучить предложение.",
    translateBook: "Перевести этот текст",
    translateBookAgain: "Перевести ещё раз",
    translateBookNeedKey: "Добавьте ключ Google Переводчика в настройках.",
    translateBookSaved: "Перевод сохранён.",
    translateBookPending: "Переведено не всё. Нажмите «Перевести этот текст» ещё раз.",
    translateBookNone: "Ни одно предложение не сохранено.",
    syncFailed: "Не удалось синхронизировать сохранённые слова.",
    actionFailed: "Действие не выполнено.",
    navLibrary: "Книги",
    navWords: "Слова",
    navAdd: "Добавить текст",
    navAccount: "Учётная запись",
    skipToText: "Перейти к тексту",
    navMain: "Основная навигация",
    navParts: "Части",
    notFoundTitle: "Страница не найдена",
    notFoundBody: "Такой страницы нет.",
    errorTitle: "Что-то пошло не так",
    errorBody: "Что-то пошло не так. Попробуйте ещё раз.",
    backToBooks: "К книгам",
    retryAction: "Попробовать ещё раз",
    hintDismiss: "Понятно",
    openInGoogle: "Открыть в Google Переводчике",
    translateNeedsKey: "Встроенный перевод требует ключа Google.",
    addGoogleKey: "Добавить ключ",
    wordSavedStatus: "Слово сохранено",
    wordRemovedStatus: "Слово убрано",
    couldNotSave: "Не удалось сохранить на этом устройстве.",
    signOutConfirm: "Удалить сохранённые слова и ключ Google с этого устройства?",
    translationMode: "Перевод на странице",
    modeSide: "Рядом",
    modeTap: "По нажатию",
    modeBlur: "Размыто до наведения",
    shortcuts: "L — прослушать, S — сохранить",
    closePanel: "Закрыть",
    loading: "Загрузка…",
    contents: "Содержание",
    appDescription: "Читайте по-английски, а перевод держите рядом.",
    partNoTranslation: "Перевода этого текста ещё нет.",
    bookFinished: "Эта книга дочитана.",
    wordsLead: "Слова, которые вы сохранили при чтении, вместе с предложением.",
    wordsSearch: "Поиск",
    wordsRecent: "Сначала новые",
    wordsAlpha: "По алфавиту",
    wordsOther: "Слова сохранены на другом языке перевода.",
    switchLanguage: "Показать их",
    readABook: "Читать книгу",
    undoAction: "Отменить",
    googleKeyHelp: "Ключ открывает перевод ваших текстов и слов, которых нет в словаре.",
    googleKeyReplace: "Заменить",
    googleKeyTest: "Проверить ключ",
    googleKeyWorks: "Ключ работает.",
    googleKeyRejected: "Google отклонил ключ.",
    practice: "Практика",
    practiceShow: "Показать ответ",
    practiceAgain: "Ещё раз",
    practiceKnow: "Знаю",
    practiceMissed: "Повторить пропущенные",
    practiceLeave: "Закрыть",
    signInPlace: "Место в каждой книге на каждом устройстве.",
    signInWords: "Сохранённые слова синхронизируются.",
    signInTexts: "Свои тексты остаются в учётной записи.",
    signInPrivacy: "Слова с этого устройства сохраняются и сливаются с учётной записью.",
    signInRedirecting: "Переходим в Google…",
    myTextsEmpty: "Здесь появятся тексты, которые вы добавите.",
    renameBook: "Переименовать",
    deleteText: "Удалить текст",
    libraryFailed: "Не удалось загрузить библиотеку.",
    confirmDeletePermanent: "Да, удалить навсегда",
    importAction: "Импортировать",
    listedAdmin: "Этот адрес задан в ADMIN_EMAILS. Роль меняется только после того, как адрес уберут из списка.",
    loadMore: "Ещё",
    searchUsers: "Поиск по имени или почте",
    roleConfirm: "Изменить роль?",
    translateKeyRejected: "Google отклонил ключ. Проверьте его в настройках.",
    translateQuota: "Лимит Google исчерпан. Попробуйте позже.",
    preparingTranslation: "Готовим перевод…",
    addTextTile: "Добавить свой текст",
    filterLanguage: "Мой язык перевода",
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
    readingPreferences: "Text appearance",
    readingFont: "Font",
    fontLiterary: "Literary",
    fontPlain: "Plain",
    fontClassic: "Classic",
    readingSize: "Size",
    sizeSmall: "Small",
    sizeRegular: "Regular",
    sizeLarge: "Large",
    readingPaper: "Background",
    paperLagoon: "Lagoon",
    paperIvory: "Ivory",
    paperNight: "Night",
    paperAuto: "Auto",
    hint: "Tap a sentence to see its translation. Tap a word to look it up.",
    translation: "Translation",
    dismiss: "Hide translation",
    catalogHeading: "Books",
    openBook: "Read",
    continueReading: "Continue reading",
    previousChapter: "Previous part",
    nextChapter: "Next part",
    chapterHeading: "Part",
    signIn: "Sign in",
    signInWithGoogle: "Sign in with Google",
    googleNotConfigured: "Google sign-in is not configured. This note is for the site owner.",
    googleSignInFailed: "Google sign-in did not complete. Try again.",
    signOut: "Sign out",
    uploadTitle: "Add your text",
    uploadTitleLabel: "Title",
    uploadTextLabel: "English text",
    uploadAction: "Save text",
    uploadSaving: "Saving…",
    uploadSaveFailed: "Could not save the text. Try again.",
    uploadHint:
      "Up to 200 sentences or 100,000 characters. After saving you can translate it with your own Google Translate key.",
    noTranslation: "This sentence has no translation yet.",
    dictionary: "Dictionary",
    noDictionaryEntry: "Not in the dictionary",
    savedWords: "Saved words",
    saveWord: "Save word",
    savedWord: "Saved",
    removeWord: "Remove from saved",
    wordsEmpty: "You have not saved any words yet.",
    exportAnki: "Export to Anki",
    ankiHint: "Open the downloaded file in Anki: File → Import.",
    downloadBook: "Download for the phone app (.2books)",
    myBooks: "My texts",
    alignmentPending: "Not translated yet",
    invalidInput: "Add a title (up to 120 characters) and some text.",
    anonymous: "Sign in to save a text.",
    tooLong: "That text is too long: 200 sentences or 100,000 characters at most.",
    uploadQuota: "You can save at most 50 texts.",
    uploadRate: "You can add at most 20 texts in an hour.",
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
    translateWord: "Translate",
    translating: "Translating…",
    translateFailed: "Could not translate this word.",
    googleKeyLabel: "Google Translate key",
    googleKeyHint: "You need a Cloud Translation API key from Google Cloud Console. Google may charge for usage.",
    googleKeySaved: "A key is saved on this device.",
    googleKeySave: "Save key",
    googleKeyClear: "Clear key",
    googleKeyTooLong: "That key is too long.",
    listenSentence: "Listen",
    readPart: "Read this part aloud",
    openInBook: "Open in the book",
    stopSpeech: "Stop",
    speakFailed: "Could not play this sentence.",
    translateBook: "Translate this text",
    translateBookAgain: "Translate again",
    translateBookNeedKey: "Add a Google Translate key in settings.",
    translateBookSaved: "The translation is saved.",
    translateBookPending: "Not everything was translated. Press \"Translate this text\" again.",
    translateBookNone: "No sentence was saved.",
    syncFailed: "Could not sync saved words.",
    actionFailed: "That action did not complete.",
    navLibrary: "Library",
    navWords: "Words",
    navAdd: "Add a text",
    navAccount: "Account",
    skipToText: "Skip to text",
    navMain: "Main",
    navParts: "Parts",
    notFoundTitle: "Page not found",
    notFoundBody: "That page does not exist.",
    errorTitle: "Something went wrong",
    errorBody: "Something went wrong. Try again.",
    backToBooks: "Back to books",
    retryAction: "Try again",
    hintDismiss: "Got it",
    openInGoogle: "Open in Google Translate",
    translateNeedsKey: "In-app translation needs a Google key.",
    addGoogleKey: "Add a key",
    wordSavedStatus: "Word saved",
    wordRemovedStatus: "Word removed",
    couldNotSave: "Could not save on this device.",
    signOutConfirm: "Remove saved words and the Google key from this device?",
    translationMode: "Page translation",
    modeSide: "Side by side",
    modeTap: "On tap",
    modeBlur: "Blurred until hover",
    shortcuts: "L listen, S save",
    closePanel: "Close",
    loading: "Loading…",
    contents: "Contents",
    appDescription: "Read English with the translation beside the text.",
    partNoTranslation: "This text has no translation yet.",
    bookFinished: "This book is finished.",
    wordsLead: "Words you saved while reading, each with its sentence.",
    wordsSearch: "Search",
    wordsRecent: "Newest",
    wordsAlpha: "Alphabetical",
    wordsOther: "These words are saved under the other translation language.",
    switchLanguage: "Show them",
    readABook: "Read a book",
    undoAction: "Undo",
    googleKeyHelp: "The key translates your own texts and words the dictionary does not have.",
    googleKeyReplace: "Replace",
    googleKeyTest: "Test key",
    googleKeyWorks: "The key works.",
    googleKeyRejected: "Google rejected the key.",
    practice: "Practice",
    practiceShow: "Show the answer",
    practiceAgain: "Again",
    practiceKnow: "Know it",
    practiceMissed: "Practice the missed ones",
    practiceLeave: "Leave",
    signInPlace: "Your place in each book, on every device.",
    signInWords: "Saved words sync across devices.",
    signInTexts: "Your own texts stay in your account.",
    signInPrivacy: "Words saved on this device are kept and merged.",
    signInRedirecting: "Redirecting to Google…",
    myTextsEmpty: "Texts you add will show up here.",
    renameBook: "Rename",
    deleteText: "Delete text",
    libraryFailed: "The library could not be loaded.",
    confirmDeletePermanent: "Yes, delete permanently",
    importAction: "Import",
    listedAdmin: "This address is in ADMIN_EMAILS. Change the role only after removing it from that list.",
    loadMore: "Load more",
    searchUsers: "Search by name or email",
    roleConfirm: "Change this role?",
    translateKeyRejected: "Google rejected the key. Check it in settings.",
    translateQuota: "Google quota exceeded. Try later.",
    preparingTranslation: "Preparing…",
    addTextTile: "Add your text",
    filterLanguage: "My translation language",
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

export function translateProgress(locale: Locale, done: number, total: number): string {
  if (locale === "uk") return `Переклад: ${done} із ${total}`;
  if (locale === "ru") return `Перевод: ${done} из ${total}`;
  return `Translating: ${done} of ${total}`;
}

export function translateBookSkipped(locale: Locale, skipped: number): string {
  if (locale === "uk") return `Не вдалося перекласти речень: ${skipped}.`;
  if (locale === "ru") return `Не удалось перевести предложений: ${skipped}.`;
  return `Sentences that could not be translated: ${skipped}.`;
}

export function documentTitle(page: string): string {
  return `${page} - 2books`;
}

export function partPosition(locale: Locale, n: number, total: number): string {
  if (locale === "uk") return `Частина ${n} з ${total}`;
  if (locale === "ru") return `Часть ${n} из ${total}`;
  return `Part ${n} of ${total}`;
}

export function partLabel(locale: Locale, n: number, total: number | null): string {
  if (total !== null && total > 0) return partPosition(locale, n, total);
  if (locale === "uk") return `Частина ${n}`;
  if (locale === "ru") return `Часть ${n}`;
  return `Part ${n}`;
}

export function nextPartLabel(locale: Locale, title: string): string {
  if (locale === "uk") return `Наступна частина: ${title}`;
  if (locale === "ru") return `Следующая часть: ${title}`;
  return `Next part: ${title}`;
}

export function translationStatus(locale: Locale, text: string): string {
  if (locale === "uk") return `Переклад: ${text}`;
  if (locale === "ru") return `Перевод: ${text}`;
  return `Translation: ${text}`;
}

export function shownLanguageLabel(locale: Locale, language: "uk" | "ru"): string {
  if (locale === "uk") return language === "uk" ? "Переклад українською" : "Переклад російською";
  if (locale === "ru") return language === "uk" ? "Перевод на украинский" : "Перевод на русский";
  return language === "uk" ? "Ukrainian translation" : "Russian translation";
}

export function readingTimeLabel(locale: Locale, minutes: number): string {
  if (locale === "uk") return `${minutes} хв`;
  if (locale === "ru") return `${minutes} мин`;
  return `${minutes} min`;
}

export function partsMeta(locale: Locale, count: number): string {
  if (locale === "uk") return `${count} част.`;
  if (locale === "ru") return `${count} част.`;
  return count === 1 ? "1 part" : `${count} parts`;
}

export function sentenceMeter(locale: Locale, sentences: number, max: number): string {
  if (locale === "uk") return `${sentences} / ${max} речень`;
  if (locale === "ru") return `${sentences} / ${max} предложений`;
  return `${sentences} / ${max} sentences`;
}

export function characterMeter(locale: Locale, characters: number, max: number): string {
  if (locale === "uk") return `${characters} / ${max} знаків`;
  if (locale === "ru") return `${characters} / ${max} знаков`;
  return `${characters} / ${max} characters`;
}

export function wordCountLabel(locale: Locale, count: number): string {
  if (locale === "uk") return count === 1 ? "1 слово" : `${count} слів`;
  if (locale === "ru") return count === 1 ? "1 слово" : `${count} слов`;
  return count === 1 ? "1 word" : `${count} words`;
}

export function exportedAnki(locale: Locale, count: number): string {
  if (locale === "uk") return `Експортовано ${count} слів.`;
  if (locale === "ru") return `Экспортировано ${count} слов.`;
  return `Exported ${count} words.`;
}

export function partSummaryLabel(locale: Locale, opened: number, saved: number): string {
  if (locale === "uk") return `Ви відкрили перекладів: ${opened}. Зберегли слів: ${saved}.`;
  if (locale === "ru") return `Вы открыли переводов: ${opened}. Сохранили слов: ${saved}.`;
  return `You opened ${opened} translations and saved ${saved} words.`;
}

export function practiceSummaryLabel(locale: Locale, total: number, again: number): string {
  if (locale === "uk") return `Карток: ${total}. Потрібна ще спроба: ${again}.`;
  if (locale === "ru") return `Карточек: ${total}. Нужна ещё попытка: ${again}.`;
  return `${total} cards. ${again} needed another try.`;
}

export function pageOfTotal(locale: Locale, shown: number, total: number): string {
  if (locale === "uk") return `${shown} із ${total}`;
  if (locale === "ru") return `${shown} из ${total}`;
  return `${shown} of ${total}`;
}

export function safeRedirectPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 1 || value.length > 300) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (value.includes("\\") || value.includes("://")) return undefined;
  return value;
}
