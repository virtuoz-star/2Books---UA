import { Platform } from "react-native";

export const colors = {
  paper: "#f3eee4",
  ink: "#1d1a16",
  muted: "#5f584e",
  line: "#ddd3c3",
  accent: "#6d3c2e",
  accentSoft: "#f0e2cf",
  card: "#fffdf8",
} as const;

export const readingFont =
  Platform.select({
    ios: "Georgia",
    android: "serif",
    default: "serif",
  }) ?? "serif";
