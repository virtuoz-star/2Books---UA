import type { Locale } from "#/i18n/types";

export type Sentence = {
  id: string;
  en: string;
  uk: string;
  ru: string;
};

export type Passage = {
  id: string;
  author: string;
  title: Record<Locale, string>;
  sentences: Sentence[];
};
