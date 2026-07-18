import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LeaderRow, LeaderboardResponse } from "@maqraa/shared";
import { AppHeader } from "../../components/AppHeader";
import { Washed } from "../../components/Background";
import { Serif } from "../../components/Serif";
import { api } from "../../lib/api";
import { cardShadow } from "../../lib/theme";
import { usePalette } from "../../lib/use-palette";

type Scope = "week" | "all";

export default function LeaderboardScreen() {
  const c = usePalette();
  const [scope, setScope] = useState<Scope>("week");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((s: Scope) => {
    setData(null);
    setError(null);
    api<LeaderboardResponse>(`/api/v1/leaderboard?scope=${s}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the leaderboard."));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(scope);
    }, [load, scope]),
  );

  const podium = data ? data.rows.slice(0, 3) : [];
  const rest = data ? data.rows.slice(3) : [];
  // Podium order: 2nd, 1st, 3rd.
  const order = [podium[1], podium[0], podium[2]];
  const heights = [96, 124, 78];
  const medals = ["#c0c4cc", "#f0c869", "#d08a52"];

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />
        <ScrollView contentContainerStyle={styles.content}>
          <Serif style={[styles.title, { color: c.fg }]}>Leaderboard</Serif>
          <View style={styles.scopeRow}>
            {(["week", "all"] as Scope[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setScope(s)}
                style={[
                  styles.scopePill,
                  {
                    backgroundColor: scope === s ? c.brand : "transparent",
                    borderColor: scope === s ? c.brand : c.border,
                  },
                ]}
              >
                <Text style={{ color: scope === s ? c.brandFg : c.fgMuted, fontWeight: "700", fontSize: 13 }}>
                  {s === "week" ? "This week" : "All time"} · by XP
                </Text>
              </Pressable>
            ))}
          </View>

          {!data ? (
            <View style={styles.center}>
              {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
            </View>
          ) : data.rows.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="podium-outline" size={40} color={c.fgMuted} />
              <Text style={{ color: c.fgMuted, textAlign: "center", paddingHorizontal: 40 }}>
                Earn XP by reading and reviewing to climb the ranks.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.podium}>
                {order.map((row, i) =>
                  row ? (
                    <View key={row.userId} style={styles.podiumCol}>
                      <Avatar row={row} tint={medals[i]} big={i === 1} />
                      <Text style={[styles.podiumName, { color: c.fg }]} numberOfLines={1}>
                        {row.isYou ? "You" : row.name}
                      </Text>
                      <Text style={{ color: c.fgMuted, fontSize: 12 }}>{row.xp.toLocaleString()}</Text>
                      <View
                        style={[
                          styles.podiumBar,
                          {
                            height: heights[i],
                            backgroundColor: row.isYou ? c.brand : c.bgMuted,
                          },
                        ]}
                      >
                        <Text style={{ color: row.isYou ? c.brandFg : c.fg, fontWeight: "800", fontSize: 20 }}>
                          {i === 1 ? 1 : i === 0 ? 2 : 3}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View key={i} style={styles.podiumCol} />
                  ),
                )}
              </View>

              <View style={{ gap: 8, marginTop: 8 }}>
                {rest.map((row, i) => (
                  <Row key={row.userId} row={row} rank={i + 4} />
                ))}
              </View>

              {data.you && data.you.rank > data.rows.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: c.fgMuted, fontSize: 12, marginBottom: 6, marginLeft: 4 }}>
                    YOUR RANK
                  </Text>
                  <Row row={data.you} rank={data.you.rank} />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Washed>
  );
}

function initials(name: string): string {
  return name === "You" ? "You" : name.charAt(0).toUpperCase();
}

function Avatar({ row, tint, big }: { row: LeaderRow; tint: string; big?: boolean }) {
  const c = usePalette();
  const size = big ? 64 : 52;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: row.isYou ? c.brand : tint,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: c.bg,
        },
      ]}
    >
      {row.avatar ? (
        <Text style={{ fontSize: big ? 30 : 24 }}>{row.avatar}</Text>
      ) : row.isYou ? (
        <Ionicons name="star" size={big ? 26 : 22} color={c.brandFg} />
      ) : (
        <Text style={{ color: "#1a1a1a", fontWeight: "800", fontSize: big ? 24 : 20 }}>
          {initials(row.name)}
        </Text>
      )}
    </View>
  );
}

function Row({ row, rank }: { row: LeaderRow; rank: number }) {
  const c = usePalette();
  return (
    <View
      style={[
        styles.row,
        cardShadow,
        {
          backgroundColor: row.isYou ? `${c.brand}1e` : c.surface,
          borderColor: row.isYou ? c.brand : c.border,
        },
      ]}
    >
      <Text style={[styles.rank, { color: c.fgMuted }]}>{rank}</Text>
      <View style={[styles.rowAvatar, { backgroundColor: row.isYou ? c.brand : c.iris }]}>
        {row.avatar ? (
          <Text style={{ fontSize: 18 }}>{row.avatar}</Text>
        ) : (
          <Text style={{ color: row.isYou ? c.brandFg : "#fff", fontWeight: "800" }}>
            {initials(row.name)}
          </Text>
        )}
      </View>
      <Text style={[styles.rowName, { color: c.fg }]} numberOfLines={1}>
        {row.isYou ? "You" : row.name}
      </Text>
      {row.streak > 0 ? (
        <View style={styles.streak}>
          <Ionicons name="flame" size={14} color={c.flame} />
          <Text style={{ color: c.flame, fontWeight: "700", fontSize: 13 }}>{row.streak}</Text>
        </View>
      ) : null}
      <Text style={[styles.rowXp, { color: c.fg }]}>{row.xp.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 12, gap: 14, paddingBottom: 40 },
  title: { fontSize: 34 },
  scopeRow: { flexDirection: "row", gap: 8 },
  scopePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  center: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 80 },
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, marginTop: 8 },
  podiumCol: { flex: 1, alignItems: "center", gap: 4 },
  podiumName: { fontWeight: "700", fontSize: 14, marginTop: 4 },
  podiumBar: {
    width: "100%",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rank: { width: 20, fontWeight: "800", fontSize: 15 },
  rowAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowName: { flex: 1, fontWeight: "600", fontSize: 15 },
  streak: { flexDirection: "row", alignItems: "center", gap: 3 },
  rowXp: { fontWeight: "800", fontSize: 15, minWidth: 56, textAlign: "right" },
});
