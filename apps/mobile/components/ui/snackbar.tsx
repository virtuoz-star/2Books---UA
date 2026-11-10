import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, space, uiScaleCap, useTheme } from "@/lib/theme";

type SnackAction = { label: string; onPress: () => void };

type Snack = { id: number; text: string; action?: SnackAction };

type SnackbarValue = {
  show: (text: string, action?: SnackAction) => void;
};

const SnackbarContext = createContext<SnackbarValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, action?: SnackAction) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setSnack({ id, text, action });
    timer.current = setTimeout(() => {
      setSnack((current) => (current?.id === id ? null : current));
    }, 5000);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  const theme = useTheme();
  return (
    <SnackbarContext.Provider value={value}>
      <View style={styles.host}>
        {children}
        {snack ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.bar,
              { backgroundColor: theme.colors.ink, shadowColor: theme.colors.ink },
            ]}
          >
            <Text maxFontSizeMultiplier={uiScaleCap} style={[styles.text, { color: theme.colors.paper }]}>
              {snack.text}
            </Text>
            {snack.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={snack.action.label}
                onPress={() => {
                  const action = snack.action;
                  setSnack(null);
                  action?.onPress();
                }}
                style={styles.action}
              >
                <Text
                  maxFontSizeMultiplier={uiScaleCap}
                  style={{ color: theme.colors.marker, fontWeight: "700", fontSize: 15 }}
                >
                  {snack.action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarValue {
  const value = useContext(SnackbarContext);
  if (value === null) throw new Error("useSnackbar must be used within SnackbarProvider");
  return value;
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  bar: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, fontSize: 15, lineHeight: 20 },
  action: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.sm },
});
