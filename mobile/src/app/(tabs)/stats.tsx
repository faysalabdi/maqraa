import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Washed } from "../../components/Background";
import {
  fetchCompletedBooksCount,
  fetchProfile,
  fetchRecentXp,
  fetchStreak,
  type Profile,
  type Streak,
  type XpEvent,
} from "../../lib/data";
import { usePalette } from "../../lib/use-palette";

export default function StatsScreen() {
  const c = usePalette();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [events, setEvents] = useState<XpEvent[]>([]);
  const [booksDone, setBooksDone] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, ev, done] = await Promise.all([
        fetchProfile(),
        fetchStreak(),
        fetchRecentXp(7),
        fetchCompletedBooksCount(),
      ]);
      setProfile(p);
      setStreak(s);
      setEvents(ev);
      setBooksDone(done);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load stats.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!loaded) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayXp = events
    .filter((e) => e.occurred_at.slice(0, 10) === todayKey)
    .reduce((sum, e) => sum + e.delta, 0);
  const weekXp = events.reduce((sum, e) => sum + e.delta, 0);
  const goal = profile?.daily_xp_goal ?? 50;

  return (
    <Washed>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: c.fg }]}>Stats</Text>
          <Pressable onPress={() => router.push("/achievements")} hitSlop={10}>
            <Ionicons name="trophy" size={24} color={c.accent} />
          </Pressable>
        </View>
        {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}

        <View style={[styles.goalCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.goalHeader}>
            <Text style={{ color: c.fgMuted, fontWeight: "600" }}>Today</Text>
            <Text style={{ color: c.fg, fontWeight: "700" }}>
              {todayXp} / {goal} XP
            </Text>
          </View>
          <View style={[styles.goalTrack, { backgroundColor: c.bgMuted }]}>
            <View
              style={[
                styles.goalFill,
                {
                  backgroundColor: todayXp >= goal ? c.brand : c.accent,
                  width: `${Math.min(100, (todayXp / goal) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.grid}>
          <StatCard icon="flame" tint={c.flame} label="Streak" value={`${streak?.current_days ?? 0}d`} />
          <StatCard icon="star" tint={c.accent} label="Total XP" value={`${profile?.xp_total ?? 0}`} />
          <StatCard icon="book" tint={c.brand} label="Books done" value={`${booksDone}`} />
          <StatCard icon="calendar" tint={c.iris} label="This week" value={`${weekXp} XP`} />
        </View>

        <Text style={[styles.sectionTitle, { color: c.fg }]}>Recent activity</Text>
        <View style={{ gap: 6 }}>
          {events.slice(0, 12).map((e, i) => (
            <View
              key={i}
              style={[styles.eventRow, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <Text style={{ color: c.fg, flex: 1, fontSize: 14 }}>
                {labelForReason(e.reason)}
              </Text>
              <Text style={{ color: c.brand, fontWeight: "700" }}>+{e.delta}</Text>
            </View>
          ))}
          {events.length === 0 ? (
            <Text style={{ color: c.fgMuted }}>Read something to start earning XP.</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
    </Washed>
  );
}

function labelForReason(reason: string): string {
  switch (reason) {
    case "page_logged":
      return "Reading";
    case "srs_review":
      return "Word review";
    case "vocab_learned":
      return "New word";
    case "test_passed":
      return "Test passed";
    case "perfect_score":
      return "Perfect score";
    case "book_completed":
      return "Book completed";
    case "streak_day":
      return "Streak bonus";
    case "achievement":
      return "Achievement";
    default:
      return reason.replaceAll("_", " ");
  }
}

function StatCard({
  icon,
  tint,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
}) {
  const c = usePalette();
  return (
    <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.statValue, { color: c.fg }]}>{value}</Text>
      <Text style={{ color: c.fgMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 30, fontWeight: "700" },
  goalCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  goalHeader: { flexDirection: "row", justifyContent: "space-between" },
  goalTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  goalFill: { height: "100%", borderRadius: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
