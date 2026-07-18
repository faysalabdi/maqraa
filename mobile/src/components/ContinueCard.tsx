import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { cardShadow } from "../lib/theme";
import { ArabicText } from "./ArabicText";
import { BookCover } from "./BookCover";
import type { Book } from "../lib/data";

// A rotating set of gradient schemes so the Continue banner feels fresh each
// open — brand green, indigo, amber, teal, plum.
const SCHEMES: [string, string][] = [
  ["#17a06a", "#0c6e46"],
  ["#4657c4", "#2b338f"],
  ["#c78a1e", "#8a5511"],
  ["#1c8f92", "#0e5c5e"],
  ["#8a4fc4", "#5a2b8f"],
];

export function randomScheme(): [string, string] {
  return SCHEMES[Math.floor(Math.random() * SCHEMES.length)];
}

/**
 * The hero "Continue reading" card — a deep indigo gradient with the book's
 * mini cover, a play button that drops straight back into the reader, a
 * progress bar, and a Stop-reading action. Mirrors the web hero.
 */
export function ContinueCard({
  book,
  chaptersDone,
  chaptersTotal,
  scheme: colorScheme,
  onPlay,
  onStop,
}: {
  book: Book;
  chaptersDone: number;
  chaptersTotal: number;
  scheme?: [string, string];
  onPlay: () => void;
  onStop: () => void;
}) {
  const pct = chaptersTotal > 0 ? Math.round((chaptersDone / chaptersTotal) * 100) : 0;
  // Colour is chosen once per mount (or handed in) so it varies between opens.
  const grad = useMemo(() => colorScheme ?? randomScheme(), [colorScheme]);

  return (
    <View style={[styles.wrap, cardShadow]}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.topRow}>
          <BookCover titleAr={book.title_ar} level={book.level} size="sm" showBand={false} />
          <View style={styles.info}>
            <Text style={styles.label}>CONTINUE READING</Text>
            <Text style={styles.titleEn} numberOfLines={1}>
              {book.title_en}
            </Text>
            <ArabicText style={styles.titleAr} numberOfLines={1}>
              {book.title_ar}
            </ArabicText>
          </View>
          <Pressable
            onPress={onPlay}
            accessibilityRole="button"
            accessibilityLabel={`Continue reading ${book.title_en}`}
            style={({ pressed }) => [styles.play, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="play" size={26} color="#1b1f4a" style={{ marginLeft: 3 }} />
          </Pressable>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(3, pct)}%` }]} />
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.meta}>
            {pct}% · {chaptersTotal > 0 ? `${chaptersDone} of ${chaptersTotal} chapters` : "—"}
          </Text>
          <Pressable onPress={onStop} style={styles.stop} accessibilityLabel="Stop reading">
            <Ionicons name="stop-circle-outline" size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.stopText}>Stop reading</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 22, overflow: "hidden" },
  card: { padding: 18, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  info: { flex: 1, gap: 3 },
  label: {
    color: "#f0c869",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  titleEn: { color: "#ffffff", fontSize: 20, fontWeight: "800" },
  titleAr: { color: "rgba(255,255,255,0.75)", fontSize: 16 },
  play: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3, backgroundColor: "#ffffff" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meta: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" },
  stop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  stopText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
});
