import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootsResponse } from "@maqraa/shared";
import { ArabicText } from "../components/ArabicText";
import { Washed } from "../components/Background";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { cardShadow, centeredContent } from "../lib/theme";
import { usePalette } from "../lib/use-palette";

/**
 * Root families: the words you have saved, grouped by the root they are built
 * from. Four words sharing ك-ت-ب are one piece of knowledge, not four, and
 * seeing them side by side is what turns vocabulary into morphology.
 */
export default function RootsScreen() {
  const c = usePalette();
  const [data, setData] = useState<RootsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);

  // Opening the screen is free: it renders whatever is already analysed and
  // only spends quota when the reader asks for more.
  const load = useCallback(() => {
    setError(null);
    api<RootsResponse>("/api/v1/roots")
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load roots."));
  }, []);

  useEffect(load, [load]);

  const analyse = useCallback(() => {
    setAnalysing(true);
    setError(null);
    api<RootsResponse>("/api/v1/roots", { body: {} })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't analyse."))
      .finally(() => setAnalysing(false));
  }, []);

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.bar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={26} color={c.fg} />
          </Pressable>
          <Text style={[styles.barTitle, { color: c.fg }]}>Root families</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, centeredContent]}>
          {error ? (
            <View style={styles.center}>
              <Text style={{ color: c.danger, textAlign: "center" }}>{error}</Text>
              <Button title="Try again" variant="ghost" onPress={load} />
            </View>
          ) : !data ? (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              <Text style={[styles.lede, { color: c.fgMuted }]}>
                Arabic builds words from roots. Words you already know that share one are
                shown together — the pattern is the part that carries the meaning.
              </Text>

              {data.families.length > 0 ? (
                <View style={[styles.statRow, { borderColor: c.border }]}>
                  <Stat label="families" value={data.coverage.families} tint={c.brand} c={c} />
                  <Stat label="words linked" value={data.coverage.words} tint={c.fg} c={c} />
                  <Stat label="unlinked" value={data.singles} tint={c.fgMuted} c={c} />
                </View>
              ) : null}

              {data.families.map((family) => (
                <View
                  key={family.root}
                  style={[
                    styles.family,
                    cardShadow,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <View style={styles.familyHead}>
                    <ArabicText style={[styles.root, { color: c.brand }]}>{family.root}</ArabicText>
                    <Text style={{ color: c.fgMuted, fontSize: 12, fontWeight: "700" }}>
                      {family.words.length} WORDS
                    </Text>
                  </View>
                  {family.words.map((word) => (
                    <View key={word.id} style={[styles.word, { borderTopColor: c.border }]}>
                      <View style={{ flex: 1 }}>
                        <ArabicText style={[styles.lemma, { color: c.fg }]}>
                          {word.lemma_ar}
                        </ArabicText>
                        <Text style={{ color: c.fgMuted, fontSize: 14 }}>{word.gloss_en}</Text>
                      </View>
                      {word.pattern ? (
                        <ArabicText
                          style={[styles.pattern, { color: c.accentFg, backgroundColor: c.accentSoft }]}
                        >
                          {word.pattern}
                        </ArabicText>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}

              {data.families.length === 0 ? (
                <View style={styles.center}>
                  <Ionicons name="git-network-outline" size={40} color={c.fgMuted} />
                  <Text style={{ color: c.fgMuted, textAlign: "center", paddingHorizontal: 24 }}>
                    {data.pending
                      ? "None of your words have been analysed yet."
                      : "No shared roots yet. Save a few more words while reading."}
                  </Text>
                </View>
              ) : null}

              {data.pending ? (
                <Button
                  title={analysing ? "Analysing…" : "Analyse more words"}
                  loading={analysing}
                  onPress={analyse}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Washed>
  );
}

function Stat({
  label,
  value,
  tint,
  c,
}: {
  label: string;
  value: number;
  tint: string;
  c: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: tint, fontSize: 22, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.fgMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  barTitle: { fontSize: 17, fontWeight: "700" },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  center: { alignItems: "center", gap: 12, paddingVertical: 60 },
  lede: { fontSize: 14, lineHeight: 21 },
  statRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
  },
  family: { borderWidth: 1, borderRadius: 20, padding: 16 },
  familyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  root: { fontSize: 30, fontWeight: "700", letterSpacing: 6 },
  word: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  lemma: { fontSize: 24, fontWeight: "700" },
  pattern: { fontSize: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
});
