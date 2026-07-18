import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArabicText } from "../../components/ArabicText";
import { deleteVocabItem, fetchVocab, type VocabItem } from "../../lib/data";
import { usePalette } from "../../lib/use-palette";

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

  const dueCount = items
    ? items.filter((i) => new Date(i.due_at).getTime() <= Date.now()).length
    : 0;

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
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: c.fg }]}>Words</Text>
        {items && items.length > 0 ? (
          <Pressable
            onPress={() => router.push("/review")}
            style={[styles.reviewButton, { backgroundColor: dueCount > 0 ? c.brand : c.bgMuted }]}
          >
            <Text style={{ color: dueCount > 0 ? c.brandFg : c.fgMuted, fontWeight: "600" }}>
              Review{dueCount > 0 ? ` (${dueCount})` : ""}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {!items ? (
        <View style={styles.center}>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={40} color={c.fgMuted} />
          <Text style={{ color: c.fgMuted, textAlign: "center", paddingHorizontal: 40 }}>
            Tap words while reading to build your review deck.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const due = new Date(item.due_at).getTime() <= Date.now();
            return (
              <Pressable
                onLongPress={() => remove(item)}
                style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <ArabicText style={[styles.lemma, { color: c.fg }]}>{item.lemma_ar}</ArabicText>
                  <Text style={{ color: c.fgMuted, fontSize: 14 }}>{item.gloss_en}</Text>
                </View>
                <View
                  style={[
                    styles.dueBadge,
                    { backgroundColor: due ? `${c.accent}30` : c.bgMuted },
                  ]}
                >
                  <Text style={{ color: due ? c.accentFg : c.fgMuted, fontSize: 11 }}>
                    {due ? "due" : `${item.interval_days}d`}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 10,
  },
  heading: { fontSize: 30, fontWeight: "700" },
  reviewButton: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  list: { padding: 20, paddingTop: 6, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  lemma: { fontSize: 22, textAlign: "left", writingDirection: "rtl" },
  dueBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
