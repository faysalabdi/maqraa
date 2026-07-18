import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Washed } from "../../components/Background";
import type { MeResponse } from "@maqraa/shared";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { useMe } from "../../lib/me-context";
import { purchasesAvailable } from "../../lib/purchases";
import { supabase } from "../../lib/supabase";
import { usePalette } from "../../lib/use-palette";

export default function SettingsScreen() {
  const c = usePalette();
  const { plan, refresh } = useMe();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      api<MeResponse>("/api/v1/me").then(setMe).catch(() => {});
    }, [refresh]),
  );

  const confirmDelete = () => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account, reading progress, vocabulary, and subscription data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await api("/api/v1/account", { method: "DELETE" });
              await supabase.auth.signOut();
            } catch (e) {
              Alert.alert("Couldn't delete", e instanceof Error ? e.message : "Try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Washed>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.fg }]}>Settings</Text>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.fg, fontSize: 16 }}>{me?.email ?? "…"}</Text>
          <Text style={{ color: plan === "pro" ? c.brand : c.fgMuted, fontWeight: "600" }}>
            {plan === "pro" ? "Maqraa Pro" : "Free plan"}
          </Text>
        </View>

        {plan === "free" && purchasesAvailable() ? (
          <Button title="Get Maqraa Pro" onPress={() => router.push("/paywall")} />
        ) : null}
        {plan === "pro" ? (
          <Row
            icon="card"
            label="Manage subscription"
            onPress={() => Linking.openURL("https://apps.apple.com/account/subscriptions")}
          />
        ) : null}
        {purchasesAvailable() ? (
          <Row icon="refresh" label="Restore purchases" onPress={() => router.push("/paywall")} />
        ) : null}
        <Row icon="book" label="Add your own book" onPress={() => router.push("/upload")} />
        <Row icon="trophy" label="Achievements" onPress={() => router.push("/achievements")} />

        <View style={{ height: 12 }} />
        <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} />
        <Button title="Delete account" variant="danger" loading={deleting} onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
    </Washed>
  );
}

function Row({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={c.fgMuted} />
      <Text style={{ color: c.fg, fontSize: 15, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={c.fgMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  heading: { fontSize: 30, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
});
