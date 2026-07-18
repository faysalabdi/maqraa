import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { GradeCardResponse, PracticeCardResponse } from "@maqraa/shared";
import { ArabicText } from "../../components/ArabicText";
import { Washed } from "../../components/Background";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { fetchDueVocab, fetchPracticeVocab, type VocabItem } from "../../lib/data";
import { usePalette } from "../../lib/use-palette";

// UI grades → SM-2 quality (same mapping as the web review page).
const GRADES = [
  { label: "Again", quality: 1, tone: "danger" },
  { label: "Hard", quality: 3, tone: "warn" },
  { label: "Good", quality: 4, tone: "brand" },
  { label: "Easy", quality: 5, tone: "iris" },
] as const;

export default function ReviewScreen() {
  const c = usePalette();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const practice = mode === "practice";
  const [queue, setQueue] = useState<VocabItem[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [xpTotal, setXpTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);

  const reload = useCallback(() => {
    setQueue(null);
    setRevealed(false);
    setXpTotal(0);
    setDoneCount(0);
    setError(null);
    (practice ? fetchPracticeVocab() : fetchDueVocab())
      .then((deck) => setQueue(practice ? deck.slice(0, 20) : deck))
      .catch((e) => setError(e.message));
  }, [practice]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const grade = async (quality: number) => {
    if (!queue || queue.length === 0 || grading) return;
    const card = queue[0];
    setGrading(true);
    try {
      // Practice drills never touch the SRS schedule — separate endpoint.
      const res = practice
        ? await api<PracticeCardResponse>(`/api/v1/review/${card.id}/practice`, { body: {} })
        : await api<GradeCardResponse>(`/api/v1/review/${card.id}/grade`, {
            body: { quality },
          });
      Haptics.impactAsync(
        quality < 3 ? Haptics.ImpactFeedbackStyle.Rigid : Haptics.ImpactFeedbackStyle.Light,
      );
      setXpTotal((x) => x + res.xpEarned);
      setDoneCount((n) => n + 1);
      setQueue((q) => (q ? q.slice(1) : q));
      setRevealed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade the card.");
    } finally {
      setGrading(false);
    }
  };

  const toneColor = (tone: (typeof GRADES)[number]["tone"]) =>
    tone === "danger" ? c.danger : tone === "warn" ? c.accent : tone === "iris" ? c.iris : c.brand;

  return (
    <Washed>
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.fg} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.fg }]}>
            {practice ? "Practice" : "Review"}
          </Text>
        </View>
        <Text style={{ color: c.fgMuted }}>
          {doneCount} done{xpTotal > 0 ? ` · +${xpTotal} XP` : ""}
        </Text>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: c.danger, textAlign: "center", padding: 24 }}>{error}</Text>
          <Button title="Try again" variant="ghost" onPress={reload} />
        </View>
      ) : !queue ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : queue.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={48} color={c.brand} />
          <Text style={[styles.doneTitle, { color: c.fg }]}>
            {doneCount > 0 ? "Session complete" : "Nothing due"}
          </Text>
          <Text style={{ color: c.fgMuted }}>
            {doneCount > 0 ? `${doneCount} cards reviewed · +${xpTotal} XP` : "Come back later."}
          </Text>
          {doneCount > 0 ? (
            <Button title={practice ? "Practice more" : "Review again"} onPress={reload} />
          ) : (
            <Button title="Back to books" variant="ghost" onPress={() => router.push("/path")} />
          )}
        </View>
      ) : (
        <View style={styles.body}>
          <Pressable
            onPress={() => setRevealed(true)}
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <ArabicText style={[styles.lemma, { color: c.fg }]}>{queue[0].lemma_ar}</ArabicText>
            {revealed ? (
              <>
                <Text style={[styles.gloss, { color: c.fg }]}>{queue[0].gloss_en}</Text>
                {queue[0].example_ar ? (
                  <ArabicText style={[styles.example, { color: c.fgMuted }]}>
                    {queue[0].example_ar}
                  </ArabicText>
                ) : null}
              </>
            ) : (
              <Text style={{ color: c.fgMuted }}>Tap to reveal</Text>
            )}
          </Pressable>

          {revealed ? (
            <View style={styles.gradeRow}>
              {GRADES.map((g) => (
                <Pressable
                  key={g.label}
                  disabled={grading}
                  onPress={() => grade(g.quality)}
                  style={[styles.gradeButton, { backgroundColor: toneColor(g.tone) }]}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "700" }}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ color: c.fgMuted, textAlign: "center" }}>
              {queue.length} card{queue.length === 1 ? "" : "s"} remaining
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
    </Washed>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 30, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  doneTitle: { fontSize: 22, fontWeight: "700" },
  body: { flex: 1, padding: 20, gap: 20, justifyContent: "center" },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 14,
    minHeight: 260,
    justifyContent: "center",
  },
  lemma: { fontSize: 40, textAlign: "center" },
  gloss: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  example: { fontSize: 20, lineHeight: 34, textAlign: "center" },
  gradeRow: { flexDirection: "row", gap: 10 },
  gradeButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
});
