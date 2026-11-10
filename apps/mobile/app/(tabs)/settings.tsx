import { ScrollView, Text, View } from "react-native";

import { GoogleKeyEditor } from "@/components/google-key-editor";
import { LanguageControls } from "@/components/language-controls";
import { ReadingPreferences } from "@/components/reading-preferences";
import { Button, Notice, Screen, TopBar } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { space, useTheme } from "@/lib/theme";

export default function SettingsScreen() {
  const auth = useAuth();
  const { settings } = useSettings();
  const { colors } = useTheme();
  const locale = settings.interfaceLocale;
  return (
    <Screen>
      <TopBar title={message(locale, "settings")} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.xl }}
      >
        <LanguageControls />
        <ReadingPreferences />
        {auth.status === "out" && !auth.googleReady ? null : (
          <View style={{ gap: space.sm }}>
            <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 18, fontWeight: "700" }}>
              {message(locale, "account")}
            </Text>
            {auth.status === "in" ? (
              <View style={{ gap: space.sm }}>
                {auth.email ? <Text style={{ color: colors.quiet, fontSize: 16 }}>{auth.email}</Text> : null}
                <Button
                  variant="secondary"
                  label={message(locale, "signOut")}
                  onPress={() => {
                    void auth.signOut();
                  }}
                />
                {auth.syncFailed ? <Notice text={message(locale, "syncFailed")} /> : null}
              </View>
            ) : auth.status === "out" ? (
              <View style={{ gap: space.sm }}>
                <Text style={{ color: colors.quiet, fontSize: 16, lineHeight: 22 }}>
                  {message(locale, "signInBenefit")}
                </Text>
                <Button
                  label={message(locale, "signInWithGoogle")}
                  onPress={() => {
                    void auth.signIn();
                  }}
                />
                {auth.signInFailed ? <Notice text={message(locale, "googleSignInFailed")} /> : null}
              </View>
            ) : null}
          </View>
        )}
        {auth.sessionCheckFailed ? <Notice text={message(locale, "sessionCheckFailed")} /> : null}
        <GoogleKeyEditor />
      </ScrollView>
    </Screen>
  );
}
