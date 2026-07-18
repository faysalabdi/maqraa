import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Washed } from "../../components/Background";
import {
  STRENGTH_LABELS,
  STRENGTH_ORDER,
  strengthFor,
  type Strength,
} from "@maqraa/shared";
import { ArabicText } from "../../components/ArabicText";
import { deleteVocabItem, fetchVocab, type VocabItem } from "../../lib/data";
import { usePalette } from "../../lib/use-palette";
import type { Palette } from "../../lib/theme";

function strengthColor(s: Strength, c: Palette): { bg: string; fg: string } {
  switch (s) {
    case "new":
      return { bg: c.bgMuted, fg: c.fgMuted };
    case "weak":
      return { bg: `${c.danger}1c`, fg: c.danger };
    case "learning":
      return { bg: `${c.accent}26`, fg: c.accentFg };
    case "strong":
      return { bg: `${c.iris}1c`, fg: c.iris };
    case "mastered":
      return { bg: `${c.brand}1c`, fg: c.brandDark };
  }
}

export default function WordsScreen() {
  const c = usePalette();
  const [items, setItems] = useState<VocabItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchVocab());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your words.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!items) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </SafeAreaView>
    );
  }

  const withStrength = items.map((item) => ({
    item,
    strength: strengthFor({
      repetitions: item.repetitions,
      intervalDays: item.interval_days,
      lapses: item.lapses,
      ease: Number(item.ease),
    }),
  }));
  const counts = new Map<Strength, number>();
  for (const w of withStrength) counts.set(w.strength, (counts.get(w.strength) ?? 0) + 1);
  const dueCount = items.filter((i) => new Date(i.due_at).getTime() <= Date.now()).length;

  const remove = (item: VocabItem) => {
    Alert.alert("Remove word", `Remove “${item.lemma_ar}” from your deck?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteVocabItem(item.lemma_ar);
            setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
          } catch (e) {
            Alert.alert("Couldn't remove", e instanceof Error ? e.message : "Try again.");
          }
        },
      },
    ]);
  };

  return (
    <Washed>
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: c.fg }]}>Words</Text>
          {items.length > 0 ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => router.push({ pathname: "/review", params: { mode: "practice" } })}
                style={[styles.headerBtn, { backgroundColor: c.bgMuted }]}
              >
                <Text style={{ color: c.fg, fontWeight: "600" }}>Practice</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/review")}
                style={[styles.headerBtn, { backgroundColor: dueCount > 0 ? c.brand : c.bgMuted }]}
              >
                <Text style={{ color: dueCount > 0 ? c.brandFg : c.fgMuted, fontWeight: "600" }}>
                  Review{dueCount > 0 ? ` (${dueCount})` : ""}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View style={[styles.center, { paddingVertical: 120 }]}>
            <Ionicons name="albums-outline" size={40} color={c.fgMuted} />
            <Text style={{ color: c.fgMuted, textAlign: "center", paddingHorizontal: 40 }}>
              Tap words while reading to build your review deck.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              {STRENGTH_ORDER.map((s) => {
                const tone = strengthColor(s, c);
                return (
                  <View key={s} style={[styles.summaryCell, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.summaryCount, { color: tone.fg }]}>
                      {counts.get(s) ?? 0}
                    </Text>
                    <Text style={{ color: tone.fg, fontSize: 11, fontWeight: "600" }}>
                      {STRENGTH_LABELS[s].labelEn}
                    </Text>
                  </View>
                );
              })}
            </View>

            {STRENGTH_ORDER.map((s) => {
              const group = withStrength.filter((w) => w.strength === s);
              if (group.length === 0) return null;
              const tone = strengthColor(s, c);
              return (
                <View key={s} style={{ gap: 8 }}>
                  <View style={styles.groupHeader}>
                    <Text
                      style={[styles.pill, { backgroundColor: tone.bg, color: tone.fg }]}
                    >
                      {STRENGTH_LABELS[s].labelEn}
                    </Text>
                    <ArabicText style={{ color: c.fgMuted, fontSize: 16 }}>
                      {STRENGTH_LABELS[s].labelAr}
                    </ArabicText>
                  </View>
                  {group.map(({ item }) => (
                    <Pressable
                      key={item.id}
                      onLongPress={() => remove(item)}
                      style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <ArabicText style={[styles.lemma, { color: c.fg }]}>
                          {item.lemma_ar}
                        </ArabicText>
                        <Text style={{ color: c.fgMuted, fontSize: 14 }} numberOfLines={1}>
                          {item.gloss_en}
                        </Text>
                        {item.example_ar ? (
                          <ArabicText
                            style={{ color: c.fgMuted, fontSize: 15 }}
                            numberOfLines={1}
                          >
                            {item.example_ar}
                          </ArabicText>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
    </Washed>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 30, fontWeight: "700" },
  headerBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  summary: { flexDirection: "row", gap: 8 },
  summaryCell: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  summaryCount: { fontSize: 20, fontWeight: "800" },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  lemma: { fontSize: 22, textAlign: "left", writingDirection: "rtl" },
});
