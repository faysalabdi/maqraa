import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AchievementsSyncResponse } from "@maqraa/shared";
import { ArabicText } from "../components/ArabicText";
import { api } from "../lib/api";
import {
  fetchAchievements,
  fetchEarnedAchievementIds,
  type Achievement,
} from "../lib/data";
import { usePalette } from "../lib/use-palette";

export default function AchievementsScreen() {
  const c = usePalette();
  const [all, setAll] = useState<Achievement[] | null>(null);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [justEarned, setJustEarned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Sync first so anything newly met shows as earned right away.
        const sync = await api<AchievementsSyncResponse>("/api/v1/achievements/sync", { body: {} });
        setJustEarned(sync.earned.map((b) => b.slug));
        const [catalogue, mine] = await Promise.all([
          fetchAchievements(),
          fetchEarnedAchievementIds(),
        ]);
        setAll(catalogue);
        setEarned(mine);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load achievements.");
      }
    })();
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.fg} />
        </Pressable>
        <Text style={[styles.heading, { color: c.fg }]}>Achievements</Text>
        <View style={{ width: 26 }} />
      </View>

      {!all ? (
        <View style={styles.center}>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {all.map((a) => {
            const has = earned.has(a.id);
            const isNew = justEarned.includes(a.slug);
            return (
              <View
                key={a.id}
                style={[
                  styles.badge,
                  {
                    backgroundColor: c.surface,
                    borderColor: isNew ? c.accent : c.border,
                    opacity: has ? 1 : 0.45,
                  },
                ]}
              >
                <Ionicons
                  name={has ? "trophy" : "trophy-outline"}
                  size={26}
                  color={has ? c.accent : c.fgMuted}
                />
                <Text style={[styles.badgeName, { color: c.fg }]} numberOfLines={1}>
                  {a.name_en}
                </Text>
                <ArabicText style={{ color: c.fgMuted, fontSize: 14 }} numberOfLines={1}>
                  {a.name_ar}
                </ArabicText>
                <Text style={{ color: c.fgMuted, fontSize: 11, textAlign: "center" }} numberOfLines={2}>
                  {a.description}
                </Text>
                {a.xp_reward > 0 ? (
                  <Text style={{ color: c.brand, fontSize: 11, fontWeight: "700" }}>
                    +{a.xp_reward} XP
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  heading: { fontSize: 17, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 20,
    paddingBottom: 40,
  },
  badge: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  badgeName: { fontSize: 14, fontWeight: "700" },
});
