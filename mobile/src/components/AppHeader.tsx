import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSession } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";
import { softShadow } from "../lib/theme";
import { Wordmark } from "./Wordmark";

/** The web mobile header: wordmark left, theme toggle + avatar (→settings) right. */
export function AppHeader() {
  const { palette: c, scheme, toggle } = useTheme();
  const { session } = useSession();
  const [avatar, setAvatar] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("profile-avatar").then((a) => setAvatar(a || null)).catch(() => {});
    }, []),
  );
  const letter = (session?.user.email ?? "?").charAt(0).toUpperCase();

  return (
    <View style={[styles.bar, { borderBottomColor: c.border, backgroundColor: c.bg }]}>
      <Wordmark height={26} />
      <View style={styles.right}>
        <Pressable
          onPress={toggle}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Toggle theme"
          style={styles.toggle}
        >
          <Ionicons name={scheme === "dark" ? "moon" : "sunny"} size={20} color={c.fgMuted} />
        </Pressable>
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={[styles.avatar, softShadow, { backgroundColor: c.brand }]}
        >
          {avatar ? (
            <Text style={{ fontSize: 18 }}>{avatar}</Text>
          ) : (
            <Text style={{ color: c.brandFg, fontWeight: "800", fontSize: 15 }}>{letter}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggle: { padding: 6 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
