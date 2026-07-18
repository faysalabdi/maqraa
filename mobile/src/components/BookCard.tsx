import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tierFor, type Tier } from "@maqraa/shared";
import type { Book } from "../lib/data";
import { usePalette } from "../lib/use-palette";
import { ArabicText } from "./ArabicText";

const TIER_COLORS: Record<Tier, string> = {
  Beginner: "#0f9663",
  Intermediate: "#e3a72f",
  Advanced: "#5b6cf0",
};

export function BookCard({
  book,
  locked,
  completed,
  onPress,
}: {
  book: Book;
  locked: boolean;
  completed?: boolean;
  onPress: () => void;
}) {
  const c = usePalette();
  const tierColor = TIER_COLORS[tierFor(book.level)];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.cover, { backgroundColor: `${tierColor}22`, borderColor: c.border }]}>
        {book.cover_url ? (
          <Image source={{ uri: book.cover_url }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <ArabicText style={[styles.coverTitle, { color: tierColor }]} numberOfLines={3}>
            {book.title_ar}
          </ArabicText>
        )}
        {locked ? (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={22} color="#ffffff" />
          </View>
        ) : null}
        {completed ? (
          <View style={[styles.doneBadge, { backgroundColor: c.brand }]}>
            <Ionicons name="checkmark" size={14} color={c.brandFg} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.title, { color: c.fg }]} numberOfLines={1}>
        {book.title_en}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 120, gap: 6 },
  cover: {
    width: 120,
    height: 168,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 10,
  },
  coverImage: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  coverTitle: { fontSize: 18, textAlign: "center" },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,24,30,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  doneBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontWeight: "500" },
});
