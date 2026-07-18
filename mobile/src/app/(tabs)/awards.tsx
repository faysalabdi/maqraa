import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AchievementsSyncResponse } from "@maqraa/shared";
import { AppHeader } from "../../components/AppHeader";
import { Washed } from "../../components/Background";
import { Serif } from "../../components/Serif";
import { api } from "../../lib/api";
import { cardShadow } from "../../lib/theme";
import {
  fetchAchievements,
  fetchEarnedAchievementIds,
  type Achievement,
} from "../../lib/data";
import { usePalette } from "../../lib/use-palette";

type Filter = "all" | "earned" | "locked";

export default function AwardsScreen() {
  const c = usePalette();
  const [all, setAll] = useState<Achievement[] | null>(null);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [justEarned, setJustEarned] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The catalogue + earned set are the page. Sync is best-effort so a failed
    // sync (e.g. API not reachable) never blanks the screen.
    try {
      const [catalogue, mine] = await Promise.all([
        fetchAchievements(),
        fetchEarnedAchievementIds(),
      ]);
      setAll(catalogue);
      setEarned(mine);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load achievements.");
      return;
    }
    api<AchievementsSyncResponse>("/api/v1/achievements/sync", { body: {} })
      .then((sync) => {
        if (sync.earned.length === 0) return;
        setJustEarned(new Set(sync.earned.map((b) => b.slug)));
        // Reflect newly-awarded badges immediately.
        fetchEarnedAchievementIds().then(setEarned).catch(() => {});
      })
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const xpEarned = useMemo(
    () => (all ?? []).filter((a) => earned.has(a.id)).reduce((s, a) => s + a.xp_reward, 0),
    [all, earned],
  );

  const counts = useMemo(() => {
    const total = all?.length ?? 0;
    const e = (all ?? []).filter((a) => earned.has(a.id)).length;
    return { all: total, earned: e, locked: total - e };
  }, [all, earned]);

  const visible = (all ?? []).filter((a) => {
    if (filter === "earned") return earned.has(a.id);
    if (filter === "locked") return !earned.has(a.id);
    return true;
  });

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{ marginBottom: 4 }}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={26} color={c.fg} />
          </Pressable>
          <Serif style={[styles.title, { color: c.fg }]}>Achievements</Serif>
          {all ? (
            <Text style={[styles.sub, { color: c.fgMuted }]}>
              <Text style={{ color: c.brand, fontWeight: "700" }}>{counts.earned}</Text> of{" "}
              {counts.all} earned · <Text style={{ color: c.accent }}>{xpEarned} XP</Text>
            </Text>
          ) : null}

          {all ? (
            <View style={styles.filterRow}>
              {(["all", "earned", "locked"] as Filter[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: filter === f ? c.brand : "transparent",
                      borderColor: filter === f ? c.brand : c.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: filter === f ? c.brandFg : c.fgMuted,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    {f === "all" ? "All" : f === "earned" ? "Earned" : "Locked"} · {counts[f]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!all ? (
            <View style={styles.center}>
              {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {visible.map((a) => {
                const has = earned.has(a.id);
                const isNew = justEarned.has(a.slug);
                return (
                  <View
                    key={a.id}
                    style={[
                      styles.row,
                      cardShadow,
                      {
                        backgroundColor: c.surface,
                        borderColor: isNew ? c.accent : c.border,
                        opacity: has ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconWrap,
                        { backgroundColor: has ? `${c.brand}22` : c.bgMuted },
                      ]}
                    >
                      <Ionicons
                        name={has ? "ribbon" : "lock-closed"}
                        size={22}
                        color={has ? c.brand : c.fgMuted}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: c.fg }]} numberOfLines={1}>
                          {a.name_en}
                        </Text>
                        {has ? (
                          <Ionicons name="checkmark-circle" size={16} color={c.brand} />
                        ) : null}
                      </View>
                      <Text style={{ color: c.fgMuted, fontSize: 13 }} numberOfLines={2}>
                        {a.description}
                      </Text>
                    </View>
                    {a.xp_reward > 0 ? (
                      <View style={[styles.xpBadge, { backgroundColor: c.bgMuted }]}>
                        <Text style={{ color: c.accentFg, fontWeight: "700", fontSize: 12 }}>
                          +{a.xp_reward}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Washed>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 12, gap: 12, paddingBottom: 40 },
  title: { fontSize: 34 },
  sub: { fontSize: 14 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  filterPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, fontWeight: "700" },
  xpBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
});
