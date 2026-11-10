import { useFonts } from "expo-font";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SnackbarProvider } from "@/components/ui";
import { AuthProvider } from "@/lib/auth";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { AppThemeProvider, useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {
  // The splash is already gone in Expo Go, or this runtime has no splash module.
});

function ThemedNavigation() {
  const theme = useTheme();
  const { ready } = useSettings();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.blotter);
  }, [theme.colors.blotter]);
  if (!ready) return null;
  const navigationTheme = {
    ...DefaultTheme,
    dark: theme.dark,
    colors: {
      ...DefaultTheme.colors,
      background: theme.colors.blotter,
      card: theme.colors.paper,
      text: theme.colors.ink,
      border: theme.colors.mist,
      primary: theme.colors.tide,
    },
  };
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.statusBar} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.blotter },
          animation: "slide_from_right",
        }}
      />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Literata: require("../assets/fonts/Literata-Regular.ttf"),
    "Literata-Medium": require("../assets/fonts/Literata-Medium.ttf"),
    "Literata-SemiBold": require("../assets/fonts/Literata-SemiBold.ttf"),
    "Literata-Italic": require("../assets/fonts/Literata-Italic.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <AppThemeProvider>
            <SnackbarProvider>
              {fontsLoaded || fontError ? <ThemedNavigation /> : null}
            </SnackbarProvider>
          </AppThemeProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
