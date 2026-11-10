import { useEffect, useRef, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, View } from "react-native";

import { radius, space, useTheme } from "@/lib/theme";

export function Sheet({
  visible,
  onClose,
  label,
  children,
  modal = false,
  onHeight,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  modal?: boolean;
  onHeight?: (height: number) => void;
}) {
  const { colors, dark } = useTheme();
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) {
      drag.setValue(0);
      onHeight?.(0);
    }
  }, [drag, onHeight, visible]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dy > 0) drag.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 72) {
          drag.setValue(0);
          onCloseRef.current();
          return;
        }
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={modal ? styles.modal : styles.dock}
      accessibilityViewIsModal={modal}
    >
      {modal ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: dark ? "rgba(0,0,0,0.55)" : "rgba(19,41,44,0.28)" }]}
        />
      ) : null}
      <Animated.View
        accessibilityLabel={label}
        onLayout={(event) => {
          onHeight?.(event.nativeEvent.layout.height);
        }}
        style={[
          styles.panel,
          {
            backgroundColor: colors.paper,
            borderColor: colors.mist,
            shadowColor: dark ? "#000000" : colors.ink,
            transform: [{ translateY: drag }],
          },
        ]}
        {...pan.panHandlers}
      >
        <View style={[styles.handle, { backgroundColor: colors.edge }]} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  modal: {
    ...StyleSheet.absoluteFill,
    zIndex: 6,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  panel: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    gap: space.md,
    maxHeight: "70%",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: space.xs,
  },
});
