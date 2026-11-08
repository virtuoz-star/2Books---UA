# Reader, first slice

The first screen is a reader. A person reads one English paragraph. Their native language is Ukrainian or Russian. Selecting a sentence shows that whole sentence in the native language. The menus are available in Ukrainian, Russian, and English.

This slice proves the reading interaction. It does not include accounts, a catalog, uploads, or a word dictionary.

## Locked decisions

- The page shows English only until a sentence is selected.
- The native language is a reader setting. This sample carries both a Ukrainian and a Russian translation, so changing the setting changes the open translation.
- The first version translates a whole sentence. A tap on a single word is later work.
- The sample is one short public-domain paragraph, aligned by hand.

## What the reader does

The passage is one paragraph of English sentences in order.

- A sentence is a selectable span inside the paragraph. The paragraph stays one block of English.
- Selecting a sentence highlights it and opens a translation panel directly under that paragraph. The panel shows the full sentence in the current native language, and nothing else from the book.
- Only one sentence is open. Selecting another sentence moves the highlight and replaces the panel text.
- Selecting the open sentence again, or dismissing the panel, clears the highlight and hides the panel.
- Changing the native language while a sentence is open replaces the panel text immediately. The English text does not change.
- Changing the interface language does not change the English text or which translation language is open.
- Click and tap both select a sentence. Enter and Space do the same when the sentence has focus. Escape clears the selection.

The highlight is visible without relying on color alone: a background plus an underline. The panel is announced as the translation of the selected sentence.

Before any sentence is selected, a short hint under the paragraph tells the reader to select a sentence. The hint hides while a translation is open.

## Settings

Two settings, both stored in the browser. There is no account in this slice. When accounts arrive, the native language moves to the account and the browser value is the fallback.

| Setting            | Choices                     | Default                                                                     |
| ------------------ | --------------------------- | --------------------------------------------------------------------------- |
| Interface language | Ukrainian, Russian, English | Ukrainian. If the browser language is Russian or English, use that instead. |
| Native language    | Ukrainian, Russian          | Ukrainian. If the browser language is Russian, use Russian.                 |

The two controls are separate. One is labeled as the language of the app. The other is labeled as the language of the translation.

The interface language translates the app name context, the hint, the panel label, the dismiss control, the setting labels, and the passage title. Author names stay as published.

## Sample

The first paragraph of _The Gift of the Magi_ by O. Henry, published in 1905. The English is public domain. The Ukrainian and Russian lines are hand alignments for this sample, not a published edition.

Title:

| Language  | Title                |
| --------- | -------------------- |
| English   | The Gift of the Magi |
| Ukrainian | Дари волхвів         |
| Russian   | Дары волхвов         |

Author: O. Henry.

Sentences, in order:

| id  | English                                                                                                                                                                                               | Ukrainian                                                                                                                                                                                       | Russian                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s1  | One dollar and eighty-seven cents.                                                                                                                                                                    | Один долар і вісімдесят сім центів.                                                                                                                                                             | Один доллар и восемьдесят семь центов.                                                                                                                                                                   |
| s2  | That was all.                                                                                                                                                                                         | Це було все.                                                                                                                                                                                    | Это было всё.                                                                                                                                                                                            |
| s3  | And sixty cents of it was in pennies.                                                                                                                                                                 | І шістдесят центів із них були одноцентовими монетами.                                                                                                                                          | И шестьдесят центов из них были одноцентовыми монетами.                                                                                                                                                  |
| s4  | Pennies saved one and two at a time by bulldozing the grocer and the vegetable man and the butcher until one’s cheeks burned with the silent imputation of parsimony that such close dealing implied. | Одноцентовики, відкладені по одному й по два, виторговані в бакалійника, овочівника й м’ясника, аж поки щоки пашіли від мовчазного докору в скнарості, який ховало таке дріб’язкове торгування. | Одноцентовики, отложенные по одному и по два, выторгованные у бакалейщика, зеленщика и мясника, пока щёки не начинали гореть от безмолвного упрёка в скаредности, который таила такая мелочная торговля. |
| s5  | Three times Della counted it.                                                                                                                                                                         | Делла перелічила їх тричі.                                                                                                                                                                      | Делла пересчитала их трижды.                                                                                                                                                                             |
| s6  | One dollar and eighty-seven cents.                                                                                                                                                                    | Один долар і вісімдесят сім центів.                                                                                                                                                             | Один доллар и восемьдесят семь центов.                                                                                                                                                                   |
| s7  | And the next day would be Christmas.                                                                                                                                                                  | А наступного дня було Різдво.                                                                                                                                                                   | А на следующий день было Рождество.                                                                                                                                                                      |

The English sentences are stored exactly as in this table, including the final period. The reader does not split text at runtime.

## Data

One passage file is the source. A later catalog can use the same shape.

```ts
type Locale = "uk" | "ru" | "en";
type NativeLanguage = "uk" | "ru";

type Sentence = {
  id: string;
  en: string;
  uk: string;
  ru: string;
};

type Passage = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  sentences: Sentence[];
};
```

The first passage id is `gift-of-the-magi-opening`.

## Screen

One route, `/`.

From top to bottom:

1. The app name, the interface-language control, and the native-language control.
2. The passage title in the interface language, then the author.
3. The English paragraph. Each sentence is its own control, separated by a space.
4. The hint, or the translation panel when a sentence is selected.

The translation panel contains:

- A label, “Translation” in the interface language.
- The native sentence.
- A dismiss control.

The panel sits under the paragraph, not in a modal and not in a second column. The English paragraph does not reflow around it.

## Interface strings

| Key               | Ukrainian                               | Russian                                      | English                                   |
| ----------------- | --------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| appName           | 2books                                  | 2books                                       | 2books                                    |
| interfaceLanguage | Мова інтерфейсу                         | Язык интерфейса                              | Interface language                        |
| nativeLanguage    | Мова перекладу                          | Язык перевода                                | Translation language                      |
| language.uk       | Українська                              | Украинский                                   | Ukrainian                                 |
| language.ru       | Російська                               | Русский                                      | Russian                                   |
| language.en       | Англійська                              | Английский                                   | English                                   |
| hint              | Оберіть речення, щоб побачити переклад. | Выберите предложение, чтобы увидеть перевод. | Select a sentence to see its translation. |
| translation       | Переклад                                | Перевод                                      | Translation                               |
| dismiss           | Сховати переклад                        | Скрыть перевод                               | Hide translation                          |
| sentenceLabel     | Речення {n}                             | Предложение {n}                              | Sentence {n}                              |

`sentenceLabel` is the accessible name of each sentence control. `{n}` is the sentence position, starting at 1.

## Out of scope

- Accounts, sign-in, and syncing settings across devices.
- A catalog, search, and more than this one passage.
- Uploads, EPUB or FB2 parsing, and machine translation.
- A word dictionary, saved words, and Anki export.
- Reading progress, audio, and a second column of translation.
- Mobile apps.

## Acceptance

- The page loads with the seven English sentences and no translation panel.
- Choosing sentence 5 shows “Делла перелічила їх тричі.” when the native language is Ukrainian, and “Делла пересчитала их трижды.” when it is Russian.
- The English paragraph is unchanged by either switch.
- Opening sentence 1 and then sentence 7 leaves only sentence 7 highlighted, with its translation in the panel.
- Opening the selected sentence again hides the panel and removes the highlight.
- Switching the interface language to English changes the hint and the setting labels, and leaves the native-language translation in place.
- Reloading the page keeps both settings.

## Assumed, and easy to change

- The translation sits under the paragraph rather than in a popover. A popover hides the following lines on a phone and clips a long sentence like s4.
- Both settings default from the browser language, with Ukrainian as the fallback. The product name is 2Books UA, so Ukrainian is the fallback rather than English.
- Sentence 4 uses “one’s” with a typographic apostrophe, matching a common print form of the 1905 text.
