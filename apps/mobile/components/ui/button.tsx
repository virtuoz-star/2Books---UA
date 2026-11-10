import { Feather } from "@expo/vector-icons";
import type { Ref } from "react";
import { Pressable, Text, type HostInstance, type StyleProp, type ViewStyle } from "react-native";

import { radius, space, uiScaleCap, useTheme } from "@/lib/theme";

type Variant = "primary" | "secondary" | "quiet" | "destructive";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  accessibilityLabel,
  style,
  ref,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<HostInstance>;
}) {
  const { colors } = useTheme();
  const fill =
    variant === "primary"
      ? colors.tide
      : variant === "destructive"
        ? colors.danger
        : variant === "secondary"
          ? colors.paper
          : "transparent";
  const ink =
    variant === "primary" ? colors.onAccent : variant === "destructive" ? colors.onDanger : colors.ink;
  const border =
    variant === "secondary" ? colors.edge : variant === "quiet" ? "transparent" : fill;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      android_ripple={{ color: colors.tideWash }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          borderRadius: radius.pill,
          borderWidth: variant === "quiet" ? 0 : 1,
          borderColor: disabled ? colors.disabledFill : border,
          backgroundColor: disabled ? colors.disabledFill : fill,
          transform: pressed && !disabled ? [{ scale: 0.98 }] : undefined,
        },
        style,
      ]}
    >
      <Text
        maxFontSizeMultiplier={uiScaleCap}
        style={{
          color: disabled ? colors.disabledInk : ink,
          fontSize: 16,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      android_ripple={{ color: colors.tideWash, borderless: true }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        backgroundColor: disabled ? colors.disabledFill : pressed ? colors.tideWash : "transparent",
      })}
    >
      <Feather name={icon} size={22} color={disabled ? colors.disabledInk : colors.ink} />
    </Pressable>
  );
}
