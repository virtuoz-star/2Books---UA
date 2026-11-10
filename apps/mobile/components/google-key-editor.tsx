import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { Button, IconButton } from "@/components/ui";
import { maxGoogleKeyLength } from "../../../src/dictionary/google-translate";
import { readPhoneGoogleKey, writePhoneGoogleKey } from "@/lib/google-translate";
import { message } from "@/lib/messages";
import { useSettings } from "@/lib/settings";
import { radius, space, useTheme } from "@/lib/theme";

const keyHelpUrl = "https://cloud.google.com/translate/docs/setup";

export function GoogleKeyEditor() {
  const { settings } = useSettings();
  const locale = settings.interfaceLocale;
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");
  const [stored, setStored] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [tooLong, setTooLong] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const refresh = useCallback(async () => {
    const key = await readPhoneGoogleKey();
    setStored(key.length > 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    if (trimmed.length > maxGoogleKeyLength) {
      setTooLong(true);
      setFailed(false);
      return;
    }
    void (async () => {
      try {
        await writePhoneGoogleKey(trimmed);
        setDraft("");
        setTooLong(false);
        setFailed(false);
        setStored(true);
        setConfirmed(true);
      } catch {
        setFailed(true);
        setConfirmed(false);
      }
    })();
  };

  const clear = () => {
    Alert.alert(message(locale, "googleKeyClearTitle"), message(locale, "googleKeyClearBody"), [
      { text: message(locale, "cancel"), style: "cancel" },
      {
        text: message(locale, "googleKeyClear"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await writePhoneGoogleKey("");
              setDraft("");
              setTooLong(false);
              setFailed(false);
              setStored(false);
              setConfirmed(false);
            } catch {
              setFailed(true);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>
        {message(locale, "googleKeyLabel")}
      </Text>
      <Text style={{ color: colors.quiet, fontSize: 15, lineHeight: 21 }}>
        {message(locale, "googleKeyPurpose")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <TextInput
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setTooLong(false);
            setFailed(false);
            setConfirmed(false);
          }}
          onSubmitEditing={save}
          returnKeyType="done"
          secureTextEntry={hidden}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={message(locale, "googleKeyPlaceholder")}
          placeholderTextColor={colors.faint}
          accessibilityLabel={message(locale, "googleKeyLabel")}
          style={{
            flex: 1,
            minHeight: 44,
            borderWidth: 1,
            borderColor: colors.edge,
            borderRadius: radius.md,
            paddingHorizontal: space.md,
            color: colors.ink,
            backgroundColor: colors.paper,
          }}
        />
        <IconButton
          icon={hidden ? "eye" : "eye-off"}
          label={message(locale, hidden ? "googleKeyShow" : "googleKeyHide")}
          onPress={() => {
            setHidden((value) => !value);
          }}
        />
      </View>
      <Text style={{ color: colors.quiet, fontSize: 15, lineHeight: 21 }}>
        {message(locale, "googleKeyHint")}
      </Text>
      {stored && draft.trim().length === 0 ? (
        <Text style={{ color: colors.quiet, fontSize: 15 }}>{message(locale, "googleKeySaved")}</Text>
      ) : null}
      {confirmed ? (
        <Text style={{ color: colors.tide, fontSize: 15 }}>{message(locale, "googleKeySaved")}</Text>
      ) : null}
      {tooLong ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 15 }}>
          {message(locale, "googleKeyTooLong")}
        </Text>
      ) : null}
      {failed ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 15 }}>
          {message(locale, "googleKeySaveFailed")}
        </Text>
      ) : null}
      <Button
        label={message(locale, "googleKeySave")}
        disabled={draft.trim().length === 0}
        onPress={save}
      />
      <Button
        variant="quiet"
        label={message(locale, "googleKeyHow")}
        onPress={() => {
          void WebBrowser.openBrowserAsync(keyHelpUrl);
        }}
      />
      {stored ? (
        <Button variant="destructive" label={message(locale, "googleKeyClear")} onPress={clear} />
      ) : null}
    </View>
  );
}
