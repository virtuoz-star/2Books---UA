export type PartStudy = {
  translations: readonly string[];
  words: readonly string[];
};

export function emptyPartStudy(): PartStudy {
  return { translations: [], words: [] };
}

export function noteTranslation(study: PartStudy, sentenceId: string): PartStudy {
  if (sentenceId.length === 0 || study.translations.includes(sentenceId)) return study;
  return { translations: [...study.translations, sentenceId], words: study.words };
}

export function noteSavedWord(study: PartStudy, wordKey: string): PartStudy {
  if (wordKey.length === 0 || study.words.includes(wordKey)) return study;
  return { translations: study.translations, words: [...study.words, wordKey] };
}
