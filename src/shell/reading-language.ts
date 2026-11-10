import { createContext, useContext } from "react";

import type { NativeLanguage } from "#/i18n/types";
import { useReaderSettings } from "#/reader/use-reader-settings";

export type ReadingLanguage = {
  nativeLanguage: NativeLanguage;
  setNativeLanguage: (nativeLanguage: NativeLanguage) => void;
};

export const ReadingLanguageContext = createContext<ReadingLanguage | null>(null);

export function useNativeLanguage(): NativeLanguage {
  const reading = useContext(ReadingLanguageContext);
  const { settings } = useReaderSettings();
  return reading?.nativeLanguage ?? settings.nativeLanguage;
}
