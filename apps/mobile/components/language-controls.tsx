import { View } from "react-native";

import { Segmented } from "@/components/ui";
import { languageName, message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { interfaceLocales, nativeLanguages, type Locale, type NativeLanguage } from "@/lib/types";

export function LanguageControls() {
  const { settings, patchSettings } = useSettings();
  const locale = settings.interfaceLocale;
  return (
    <View style={{ gap: 16 }}>
      <Segmented
        label={message(locale, "interfaceLanguage")}
        value={settings.interfaceLocale}
        options={interfaceLocales.map((value) => ({
          value,
          label: languageName(locale, value),
        }))}
        onChange={(interfaceLocale: Locale) => {
          patchSettings({ interfaceLocale });
        }}
      />
      <Segmented
        label={message(locale, "nativeLanguage")}
        value={settings.nativeLanguage}
        options={nativeLanguages.map((value) => ({
          value,
          label: languageName(locale, value),
        }))}
        onChange={(nativeLanguage: NativeLanguage) => {
          patchSettings({ nativeLanguage });
        }}
      />
    </View>
  );
}
