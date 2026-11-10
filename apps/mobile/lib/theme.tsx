import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { useSettings } from "@/lib/settings";
import {
  palettes,
  paperForScheme,
  type AppTheme,
} from "@/lib/theme-tokens";

export {
  contrastRatio,
  palettes,
  paperForScheme,
  radius,
  readingFontFamily,
  readingMetrics,
  space,
  uiScaleCap,
  type AppTheme,
  type Palette,
} from "@/lib/theme-tokens";

const ThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const paper = paperForScheme(settings.readingPaper, scheme);
  const value = useMemo<AppTheme>(
    () => ({
      paper,
      colors: palettes[paper],
      dark: paper === "night",
      statusBar: paper === "night" ? "light" : "dark",
    }),
    [paper],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error("useTheme must be used within AppThemeProvider");
  return value;
}
