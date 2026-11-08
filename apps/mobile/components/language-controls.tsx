import { Pressable, StyleSheet, Text, View } from "react-native";

import { languageName, message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { colors } from "@/lib/theme";
import { interfaceLocales, nativeLanguages, type Locale, type NativeLanguage } from "@/lib/types";

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(option);
              }}
              style={({ pressed }) => [
                styles.chip,
                selected ? styles.chipSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                {optionLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function LanguageControls() {
  const { settings, updateSettings } = useSettings();
  const locale = settings.interfaceLocale;

  return (
    <View style={styles.controls}>
      <ChoiceRow
        label={message(locale, "interfaceLanguage")}
        value={settings.interfaceLocale}
        options={interfaceLocales}
        optionLabel={(option: Locale) => languageName(locale, option)}
        onChange={(interfaceLocale) => {
          updateSettings({ ...settings, interfaceLocale });
        }}
      />
      <ChoiceRow
        label={message(locale, "nativeLanguage")}
        value={settings.nativeLanguage}
        options={nativeLanguages}
        optionLabel={(option: NativeLanguage) => languageName(locale, option)}
        onChange={(nativeLanguage) => {
          updateSettings({ ...settings, nativeLanguage });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: 16,
  },
  group: {
    gap: 8,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.ink,
    fontSize: 15,
  },
  chipTextSelected: {
    color: colors.card,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.7,
  },
});
