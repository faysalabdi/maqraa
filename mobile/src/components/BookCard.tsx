import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Book } from "../lib/data";
import { usePalette } from "../lib/use-palette";
import { BookCover } from "./BookCover";

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

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${book.title_en}${locked ? ", locked" : ""}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        <BookCover
          titleAr={book.title_ar}
          authorAr={book.author_ar}
          authorEn={book.author_en}
          level={book.level}
          size="md"
        />
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
  card: { width: 120, gap: 8 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
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
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
  },
  title: { fontSize: 13, fontWeight: "500" },
});
