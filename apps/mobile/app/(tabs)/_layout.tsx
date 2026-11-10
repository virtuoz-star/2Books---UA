import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const locale = settings.interfaceLocale;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tide,
        tabBarInactiveTintColor: colors.quiet,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.mist,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: message(locale, "books"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="book" color={typeof color === "string" ? color : colors.ink} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="words"
        options={{
          title: message(locale, "savedWords"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="bookmark" color={typeof color === "string" ? color : colors.ink} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: message(locale, "settings"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" color={typeof color === "string" ? color : colors.ink} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
