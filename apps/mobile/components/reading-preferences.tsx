import { Segmented } from "@/components/ui";
import { message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { readingFonts, readingPapers, readingSizes, type ReadingFont, type ReadingPaper, type ReadingSize } from "@/lib/types";

const fontKey = {
  literary: "fontLiterary",
  plain: "fontPlain",
  classic: "fontClassic",
} as const satisfies Record<ReadingFont, "fontLiterary" | "fontPlain" | "fontClassic">;

const sizeKey = {
  small: "sizeSmall",
  regular: "sizeRegular",
  large: "sizeLarge",
} as const satisfies Record<ReadingSize, "sizeSmall" | "sizeRegular" | "sizeLarge">;

const paperKey = {
  auto: "paperAuto",
  lagoon: "paperLagoon",
  ivory: "paperIvory",
  night: "paperNight",
} as const satisfies Record<ReadingPaper, "paperAuto" | "paperLagoon" | "paperIvory" | "paperNight">;

export function ReadingPreferences() {
  const { settings, patchSettings } = useSettings();
  const locale = settings.interfaceLocale;
  return (
    <>
      <Segmented
        label={message(locale, "readingSize")}
        value={settings.readingSize}
        options={readingSizes.map((value) => ({ value, label: message(locale, sizeKey[value]) }))}
        onChange={(readingSize) => {
          patchSettings({ readingSize });
        }}
      />
      <Segmented
        label={message(locale, "readingFont")}
        value={settings.readingFont}
        options={readingFonts.map((value) => ({ value, label: message(locale, fontKey[value]) }))}
        onChange={(readingFont) => {
          patchSettings({ readingFont });
        }}
      />
      <Segmented
        label={message(locale, "readingPaper")}
        value={settings.readingPaper}
        options={readingPapers.map((value) => ({ value, label: message(locale, paperKey[value]) }))}
        onChange={(readingPaper) => {
          patchSettings({ readingPaper });
        }}
      />
    </>
  );
}
