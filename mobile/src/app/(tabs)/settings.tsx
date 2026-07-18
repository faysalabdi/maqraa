import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Washed } from "../../components/Background";
import type { MeResponse } from "@maqraa/shared";
import { Button, Input } from "../../components/ui";
import { api } from "../../lib/api";
import { fetchProfile, updateProfile } from "../../lib/data";
import { useMe } from "../../lib/me-context";
import { purchasesAvailable } from "../../lib/purchases";
import { supabase } from "../../lib/supabase";
import { usePalette } from "../../lib/use-palette";

const AVATARS = ["📖", "🌙", "⭐", "🦉", "🕌", "🌴", "🐫", "☕", "🖊️", "🧠", "🔥", "🏆"];

export default function SettingsScreen() {
  const c = usePalette();
  const { plan, refresh } = useMe();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      api<MeResponse>("/api/v1/me").then(setMe).catch(() => {});
      fetchProfile()
        .then((p) => {
          if (p) {
            setName(p.display_name ?? "");
            setAvatar(p.avatar ?? null);
          }
        })
        .catch(() => {});
    }, [refresh]),
  );

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ display_name: name.trim() || null, avatar });
      // Mirror locally so the header updates instantly across the app.
      await AsyncStorage.setItem("profile-avatar", avatar ?? "");
      await AsyncStorage.setItem("profile-name", name.trim());
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Try again.");
    } finally {
      setSavingProfile(false);
    }
  };

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
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={26} color={c.fg} />
            </Pressable>
            <Text style={[styles.heading, { color: c.fg }]}>Settings</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={{ color: c.fg, fontSize: 16 }}>{me?.email ?? "…"}</Text>
            <Text style={{ color: plan === "pro" ? c.brand : c.fgMuted, fontWeight: "600" }}>
              {plan === "pro" ? "Maqraa Pro" : "Free plan"}
            </Text>
          </View>

          {/* Profile: display name + avatar shown on the leaderboard and header. */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border, gap: 12 }]}>
            <View style={styles.profileTop}>
              <View style={[styles.avatarPreview, { backgroundColor: c.brand }]}>
                <Text style={{ fontSize: 26 }}>
                  {avatar || (name || me?.email || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.fgMuted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
                  DISPLAY NAME
                </Text>
                <Input
                  placeholder="Your name"
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                  autoCapitalize="words"
                />
              </View>
            </View>
            <Text style={{ color: c.fgMuted, fontSize: 12, fontWeight: "700" }}>AVATAR</Text>
            <View style={styles.emojiGrid}>
              {AVATARS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setAvatar(avatar === e ? null : e)}
                  style={[
                    styles.emoji,
                    {
                      backgroundColor: avatar === e ? `${c.brand}22` : c.bgMuted,
                      borderColor: avatar === e ? c.brand : "transparent",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <Button
              title={savedTick ? "Saved ✓" : "Save profile"}
              onPress={saveProfile}
              loading={savingProfile}
            />
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
          <Row icon="trophy" label="Achievements" onPress={() => router.push("/awards")} />

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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 20, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 },
  profileTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emoji: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
});
