import type { ReadingFont, ReadingPaper, ReadingSize } from "@/lib/types";

export type Palette = {
  blotter: string;
  paper: string;
  ink: string;
  quiet: string;
  faint: string;
  mist: string;
  edge: string;
  tide: string;
  tideWash: string;
  onAccent: string;
  marker: string;
  markerInk: string;
  danger: string;
  onDanger: string;
  disabledFill: string;
  disabledInk: string;
};

/** Lagoon, ivory, and night from src/styles.css. `edge` is the 3:1 control boundary. */
export const palettes = {
  lagoon: {
    blotter: "#e8f0eb",
    paper: "#fafcf9",
    ink: "#13292c",
    quiet: "#4a605c",
    faint: "#566b66",
    mist: "#d3e0d9",
    edge: "#6f867d",
    tide: "#17635d",
    tideWash: "#d2eae3",
    onAccent: "#f6fbf8",
    marker: "#ffe08a",
    markerInk: "#5c3f00",
    danger: "#a2372d",
    onDanger: "#f6fbf8",
    disabledFill: "#d3e0d9",
    disabledInk: "#4a605c",
  },
  ivory: {
    blotter: "#f2e9d8",
    paper: "#fcf8ee",
    ink: "#2a231a",
    quiet: "#62574a",
    faint: "#74685a",
    mist: "#e3d7c1",
    edge: "#8a7a60",
    tide: "#1a5c56",
    tideWash: "#e9dcc2",
    onAccent: "#fbf8f0",
    marker: "#ffd978",
    markerInk: "#5c3f00",
    danger: "#9c3429",
    onDanger: "#fbf8f0",
    disabledFill: "#e3d7c1",
    disabledInk: "#62574a",
  },
  night: {
    blotter: "#0e1718",
    paper: "#152022",
    ink: "#e3eeea",
    quiet: "#a3b9b3",
    faint: "#8ea59f",
    mist: "#26393a",
    edge: "#5a7572",
    tide: "#7fd1c6",
    tideWash: "#1b3536",
    onAccent: "#0c1f1e",
    marker: "#6d5a1e",
    markerInk: "#f6dc8c",
    danger: "#f09a91",
    onDanger: "#0c1f1e",
    disabledFill: "#26393a",
    disabledInk: "#a3b9b3",
  },
} as const satisfies Record<Exclude<ReadingPaper, "auto">, Palette>;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const readingMetrics = {
  small: { fontSize: 17, lineHeight: 27 },
  regular: { fontSize: 20, lineHeight: 33 },
  large: { fontSize: 24, lineHeight: 37 },
} as const satisfies Record<ReadingSize, { fontSize: number; lineHeight: number }>;

export const uiScaleCap = 1.3;

export function readingFontFamily(font: ReadingFont): string | undefined {
  if (font === "plain") return undefined;
  if (font === "classic") return "Literata-Medium";
  return "Literata";
}

export type AppTheme = {
  paper: Exclude<ReadingPaper, "auto">;
  colors: Palette;
  dark: boolean;
  statusBar: "light" | "dark";
};

export function paperForScheme(
  paper: ReadingPaper,
  scheme: "light" | "dark" | null | undefined,
): Exclude<ReadingPaper, "auto"> {
  if (paper === "ivory" || paper === "night" || paper === "lagoon") return paper;
  return scheme === "dark" ? "night" : "lagoon";
}

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
  const left = luminance(foreground);
  const right = luminance(background);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}
