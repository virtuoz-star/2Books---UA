import { ActivityIndicator, Text, View } from "react-native";

import { Notice } from "@/components/ui";
import { message } from "@/lib/messages";
import { space, useTheme } from "@/lib/theme";
import type { Locale } from "@/lib/types";

export function ScreenState({
  locale,
  error,
  onRetry,
}: {
  locale: Locale;
  error: boolean;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  if (!error) {
    return (
      <View accessibilityRole="progressbar" style={{ alignItems: "flex-start", gap: space.md, paddingVertical: space.md }}>
        <ActivityIndicator color={colors.tide} />
        <Text style={{ color: colors.quiet, fontSize: 16 }}>{message(locale, "loading")}</Text>
      </View>
    );
  }
  return (
    <Notice
      text={message(locale, "loadError")}
      actionLabel={message(locale, "retry")}
      onAction={onRetry}
    />
  );
}
