import { useEffect, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edges } from "react-native-safe-area-context";

import { radius, space, uiScaleCap, useTheme } from "@/lib/theme";

export function Screen({
  children,
  edges = ["top", "left", "right"],
}: {
  children: ReactNode;
  edges?: Edges;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.blotter }} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function TopBar({
  title,
  subtitle,
  onSubtitlePress,
  leading,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onSubtitlePress?: () => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const subtitleNode = subtitle ? (
    <Text
      maxFontSizeMultiplier={uiScaleCap}
      numberOfLines={1}
      style={{ color: colors.quiet, fontSize: 13 }}
    >
      {subtitle}
    </Text>
  ) : null;
  return (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        backgroundColor: colors.blotter,
      }}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={uiScaleCap}
          numberOfLines={1}
          style={{ color: colors.ink, fontFamily: "Literata", fontSize: 20, lineHeight: 26 }}
        >
          {title}
        </Text>
        {onSubtitlePress && subtitle ? (
          <Pressable accessibilityRole="button" accessibilityLabel={subtitle} onPress={onSubtitlePress}>
            {subtitleNode}
          </Pressable>
        ) : (
          subtitleNode
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>{trailing}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.paper,
          borderColor: colors.mist,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Notice({
  text,
  actionLabel,
  onAction,
  onDismiss,
  dismissLabel,
}: {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const { colors } = useTheme();
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.edge,
        backgroundColor: colors.paper,
      }}
    >
      <Text maxFontSizeMultiplier={uiScaleCap} style={{ color: colors.ink, fontSize: 16, lineHeight: 22 }}>
        {text}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {onAction && actionLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm }}
          >
            <Text maxFontSizeMultiplier={uiScaleCap} style={{ color: colors.tide, fontWeight: "700" }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
        {onDismiss && dismissLabel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dismissLabel}
            onPress={onDismiss}
            style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm }}
          >
            <Text maxFontSizeMultiplier={uiScaleCap} style={{ color: colors.quiet, fontWeight: "600" }}>
              {dismissLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space.sm }}>
      <Text maxFontSizeMultiplier={uiScaleCap} style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              android_ripple={{ color: colors.tideWash }}
              onPress={() => {
                onChange(option.value);
              }}
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: "center",
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: checked ? colors.tide : colors.edge,
                backgroundColor: checked ? colors.tide : pressed ? colors.tideWash : colors.paper,
              })}
            >
              <Text
                maxFontSizeMultiplier={uiScaleCap}
                style={{
                  color: checked ? colors.onAccent : colors.ink,
                  fontSize: 15,
                  fontWeight: checked ? "700" : "400",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ height: 3, backgroundColor: colors.mist }}
    >
      <View style={{ width: `${clamped * 100}%`, height: 3, backgroundColor: colors.tide }} />
    </View>
  );
}

const coverPairs = [
  ["#17635d", "#7fd1c6"],
  ["#1a5c56", "#d2eae3"],
  ["#0c3f3b", "#ffe08a"],
  ["#2f6a4a", "#e8f0eb"],
  ["#5c3f00", "#ffd978"],
  ["#1b3536", "#7fd1c6"],
] as const;

function coverHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function BookCover({ bookId, title }: { bookId: string; title: string }) {
  const pair = coverPairs[coverHash(bookId) % coverPairs.length] ?? coverPairs[0];
  const letter = title.trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: 56, height: 76 }}>
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 6,
          width: 44,
          height: 64,
          borderRadius: 4,
          backgroundColor: pair[1],
        }}
      />
      <View
        style={{
          width: 46,
          height: 70,
          borderRadius: 4,
          backgroundColor: pair[0],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          maxFontSizeMultiplier={uiScaleCap}
          style={{ color: "#f6fbf8", fontFamily: "Literata", fontSize: 22 }}
        >
          {letter}
        </Text>
      </View>
    </View>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.md, paddingVertical: space.lg }}>
      <Text style={{ color: colors.quiet, fontSize: 16, lineHeight: 22 }}>{text}</Text>
      {action}
    </View>
  );
}

export function SkeletonBlock({ height = 88 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: radius.lg,
        backgroundColor: colors.mist,
        borderWidth: 1,
        borderColor: colors.edge,
      }}
    />
  );
}
