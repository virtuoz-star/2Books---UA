import { Field, Select } from "#/components/ui/field";
import { GoogleKeyForm } from "#/dictionary/google-key-form";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { languageName, message, type MessageKey } from "#/i18n/messages";
import type { Locale, NativeLanguage } from "#/i18n/types";
import {
  readingFonts,
  readingPapers,
  readingSizes,
  translationModes,
  type ReadingFont,
  type ReadingPaper,
  type ReadingSize,
  type TranslationMode,
} from "#/preferences/settings";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { ReadingLanguageContext, useNativeLanguage } from "#/shell/reading-language";
import { useContext } from "react";

const interfaceLocales = ["uk", "ru", "en"] as const satisfies readonly Locale[];
const nativeLanguages = ["uk", "ru"] as const satisfies readonly NativeLanguage[];

const fontLabel = {
  literary: "fontLiterary",
  plain: "fontPlain",
  classic: "fontClassic",
} as const satisfies Record<ReadingFont, MessageKey>;

const sizeLabel = {
  small: "sizeSmall",
  regular: "sizeRegular",
  large: "sizeLarge",
} as const satisfies Record<ReadingSize, MessageKey>;

const paperLabel = {
  auto: "paperAuto",
  lagoon: "paperLagoon",
  ivory: "paperIvory",
  night: "paperNight",
} as const satisfies Record<ReadingPaper, MessageKey>;

const modeLabel = {
  tap: "modeTap",
  side: "modeSide",
  blur: "modeBlur",
} as const satisfies Record<TranslationMode, MessageKey>;

export function SettingsMenu() {
  const { settings, updateSettings } = useReaderSettings();
  const reading = useContext(ReadingLanguageContext);
  const nativeLanguage = useNativeLanguage();
  const locale = settings.interfaceLocale;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="icon-btn btn btn-quiet font-serif text-lg" aria-label={message(locale, "readingPreferences")}>
          Aa
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[70vh] w-80 flex-col gap-3 overflow-auto">
        <Choice
          id="interface-language"
          label={message(locale, "interfaceLanguage")}
          value={settings.interfaceLocale}
          options={interfaceLocales}
          labelFor={(option) => languageName(locale, option)}
          onChange={(interfaceLocale) => {
            updateSettings({ ...settings, interfaceLocale });
          }}
        />
        <Choice
          id="native-language"
          label={message(locale, "nativeLanguage")}
          value={nativeLanguage}
          options={nativeLanguages}
          labelFor={(option) => languageName(locale, option)}
          onChange={(next) => {
            if (reading) reading.setNativeLanguage(next);
            else updateSettings({ ...settings, nativeLanguage: next });
          }}
        />
        <Choice
          id="reading-font"
          label={message(locale, "readingFont")}
          value={settings.readingFont}
          options={readingFonts}
          labelFor={(font) => message(locale, fontLabel[font])}
          onChange={(readingFont) => {
            updateSettings({ ...settings, readingFont });
          }}
        />
        <Choice
          id="reading-size"
          label={message(locale, "readingSize")}
          value={settings.readingSize}
          options={readingSizes}
          labelFor={(size) => message(locale, sizeLabel[size])}
          onChange={(readingSize) => {
            updateSettings({ ...settings, readingSize });
          }}
        />
        <Choice
          id="reading-paper"
          label={message(locale, "readingPaper")}
          value={settings.readingPaper}
          options={readingPapers}
          labelFor={(paper) => message(locale, paperLabel[paper])}
          onChange={(readingPaper) => {
            updateSettings({ ...settings, readingPaper });
          }}
        />
        <Choice
          id="translation-mode"
          label={message(locale, "translationMode")}
          value={settings.translationMode}
          options={translationModes}
          labelFor={(mode) => message(locale, modeLabel[mode])}
          onChange={(translationMode) => {
            updateSettings({ ...settings, translationMode });
          }}
        />
        <GoogleKeyForm locale={locale} />
      </PopoverContent>
    </Popover>
  );
}

function Choice<T extends string>({
  id,
  label,
  value,
  options,
  labelFor,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labelFor: (option: T) => string;
  onChange: (value: T) => void;
}) {
  return (
    <Field id={id} label={label}>
      <Select
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option === event.target.value);
          if (next !== undefined) onChange(next);
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor(option)}
          </option>
        ))}
      </Select>
    </Field>
  );
}
