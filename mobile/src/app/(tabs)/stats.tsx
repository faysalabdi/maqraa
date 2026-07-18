import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../components/AppHeader";
import { Washed } from "../../components/Background";
import { GoalRing } from "../../components/GoalRing";
import { Serif } from "../../components/Serif";
import { cardShadow } from "../../lib/theme";
import {
  fetchCompletedBooksCount,
  fetchLevels,
  fetchProfile,
  fetchRecentXp,
  fetchStreak,
  fetchWordsCount,
  type Level,
  type Profile,
  type Streak,
  type XpEvent,
} from "../../lib/data";
import { usePalette } from "../../lib/use-palette";

export default function ProgressScreen() {
  const c = usePalette();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [events, setEvents] = useState<XpEvent[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [booksDone, setBooksDone] = useState(0);
  const [words, setWords] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s, ev, done, lv, w] = await Promise.all([
        fetchProfile(),
        fetchStreak(),
        fetchRecentXp(7),
        fetchCompletedBooksCount(),
        fetchLevels(),
        fetchWordsCount(),
      ]);
      setProfile(p);
      setStreak(s);
      setEvents(ev);
      setBooksDone(done);
      setLevels(lv);
      setWords(w);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load progress.");
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
      <Washed>
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        </SafeAreaView>
      </Washed>
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayXp = events
    .filter((e) => e.occurred_at.slice(0, 10) === todayKey)
    .reduce((sum, e) => sum + e.delta, 0);
  const goal = profile?.daily_xp_goal ?? 50;
  const toGo = Math.max(0, goal - todayXp);

  const currentLevel =
    levels.find((l) => booksDone < l.books_required_to_clear) ?? levels[levels.length - 1];
  const levelIndex = currentLevel ? levels.findIndex((l) => l.level === currentLevel.level) : 0;
  const booksBefore = levels.slice(0, levelIndex).reduce((s, l) => s + l.books_required_to_clear, 0);
  const inLevel = Math.max(0, booksDone - booksBefore);
  const need = currentLevel?.books_required_to_clear ?? 1;

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />
        <ScrollView contentContainerStyle={styles.content}>
          <Serif style={[styles.title, { color: c.fg }]}>Progress</Serif>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}

          <View style={[styles.goalCard, cardShadow, { backgroundColor: c.surface, borderColor: c.border }]}>
            <GoalRing value={todayXp} goal={goal} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.goalLabel}>
                <Ionicons name="ellipse" size={10} color={c.accent} />
                <Text style={{ color: c.fgMuted, fontWeight: "800", fontSize: 11, letterSpacing: 1 }}>
                  DAILY GOAL
                </Text>
              </View>
              <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600", lineHeight: 22 }}>
                {toGo > 0 ? `${toGo} XP to go — one review session.` : "Goal reached. Nicely done."}
              </Text>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={[styles.card, styles.stageCard, cardShadow, { backgroundColor: `${c.brand}14`, borderColor: `${c.brand}44` }]}>
              <View style={styles.cardHead}>
                <Ionicons name="sparkles" size={14} color={c.brand} />
                <Text style={[styles.cardEyebrow, { color: c.brand }]}>STAGE</Text>
              </View>
              <Text style={[styles.stageName, { color: c.fg }]}>{currentLevel?.name_en ?? "—"}</Text>
              <View style={[styles.track, { backgroundColor: c.bgMuted }]}>
                <View style={[styles.fill, { backgroundColor: c.brand, width: `${Math.min(100, (inLevel / need) * 100)}%` }]} />
              </View>
              <Text style={{ color: c.fgMuted, fontSize: 12 }}>{inLevel} of {need} books</Text>
            </View>

            <View style={[styles.card, cardShadow, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.cardHead}>
                <Ionicons name="flame" size={18} color={c.flame} />
                <Text style={[styles.bigNum, { color: c.fg }]}>{streak?.current_days ?? 0}</Text>
              </View>
              <Text style={{ color: c.fg, fontSize: 14, fontWeight: "600" }}>day streak</Text>
              <Text style={{ color: c.fgMuted, fontSize: 12 }}>
                {streak?.freezes_remaining ?? 0} freezes left
              </Text>
            </View>
          </View>

          <View style={styles.row2}>
            <Tile icon="checkbox" tint={c.brand} value={booksDone} label="Books finished" />
            <Tile icon="albums" tint={c.iris} value={words} label="Words saved" />
          </View>
          <View style={styles.row2}>
            <Tile icon="star" tint={c.accent} value={profile?.xp_total ?? 0} label="Total XP" />
            <Tile
              icon="calendar"
              tint={c.fgMuted}
              value={events.reduce((s, e) => s + e.delta, 0)}
              label="XP this week"
            />
          </View>

          <Pressable
            onPress={() => router.push("/awards")}
            style={({ pressed }) => [
              styles.linkRow,
              cardShadow,
              { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Achievements"
          >
            <View style={[styles.linkIcon, { backgroundColor: `${c.accent}22` }]}>
              <Ionicons name="trophy" size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.fg, fontWeight: "700", fontSize: 15 }}>Achievements</Text>
              <Text style={{ color: c.fgMuted, fontSize: 13 }}>Badges you've earned and what's next</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.fgMuted} />
          </Pressable>

          <Text style={[styles.sectionTitle, { color: c.fg }]}>Recent activity</Text>
          <View style={{ gap: 6 }}>
            {events.slice(0, 12).map((e, i) => (
              <View key={i} style={[styles.eventRow, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={{ color: c.fg, flex: 1, fontSize: 14 }}>{labelForReason(e.reason)}</Text>
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

function Tile({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: number;
  label: string;
}) {
  const c = usePalette();
  return (
    <View style={[styles.card, cardShadow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={[styles.bigNum, { color: c.fg }]}>{value.toLocaleString()}</Text>
      <Text style={{ color: c.fgMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function labelForReason(reason: string): string {
  const m: Record<string, string> = {
    page_logged: "Reading",
    srs_review: "Word review",
    vocab_learned: "New word",
    test_passed: "Test passed",
    perfect_score: "Perfect score",
    book_completed: "Book completed",
    streak_day: "Streak bonus",
    achievement: "Achievement",
  };
  return m[reason] ?? reason.replaceAll("_", " ");
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 12, gap: 12, paddingBottom: 40 },
  title: { fontSize: 34, marginBottom: 2 },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  goalLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  row2: { flexDirection: "row", gap: 12 },
  card: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16, gap: 6 },
  stageCard: { gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  stageName: { fontSize: 20, fontWeight: "800" },
  bigNum: { fontSize: 26, fontWeight: "800" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  linkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
