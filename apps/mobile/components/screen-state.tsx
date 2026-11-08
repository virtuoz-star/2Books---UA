import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { message } from "@/lib/messages";
import { colors } from "@/lib/theme";
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
  if (!error) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>{message(locale, "loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message(locale, "loadError")}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
      >
        <Text style={styles.retryText}>{message(locale, "retry")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 16,
  },
  errorBox: {
    gap: 12,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.ink,
    fontSize: 16,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  retryText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.7,
  },
});
