import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { tierFor, type Tier } from "@maqraa/shared";
import { ArabicText } from "./ArabicText";

// Mirror of the web BookCover: tier-coloured gradient covers so a shelf reads
// as one level at a glance — green Beginner, indigo Intermediate, gold Advanced.
const TIER_COVER: Record<Tier, [string, string]> = {
  Beginner: ["#1aa66f", "#0b6644"],
  Intermediate: ["#4f63d8", "#2b3aa0"],
  Advanced: ["#c08a1e", "#855011"],
};

const SIZES = {
  sm: { w: 64, title: 15, author: 8, chip: 8 },
  md: { w: 120, title: 20, author: 10, chip: 10 },
  lg: { w: 160, title: 24, author: 12, chip: 11 },
} as const;

export function BookCover({
  titleAr,
  authorAr,
  authorEn,
  level,
  size = "md",
  showBand = true,
  style,
}: {
  titleAr: string;
  authorAr?: string | null;
  authorEn?: string | null;
  level?: number;
  size?: keyof typeof SIZES;
  showBand?: boolean;
  style?: ViewStyle;
}) {
  const tier = level != null ? tierFor(level) : "Beginner";
  const [c1, c2] = TIER_COVER[tier];
  const s = SIZES[size];
  const author = authorAr || authorEn;

  return (
    <View
      style={[
        styles.cover,
        { width: s.w, height: (s.w * 4) / 3, borderRadius: s.w > 100 ? 16 : 12 },
        style,
      ]}
    >
      <LinearGradient
        colors={[c1, c2]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {showBand ? (
        <View style={styles.chip}>
          <Text style={[styles.chipText, { fontSize: s.chip }]}>{tier}</Text>
        </View>
      ) : null}
      <View style={styles.center}>
        <ArabicText style={[styles.title, { fontSize: s.title }]} numberOfLines={3}>
          {titleAr}
        </ArabicText>
        {author ? (
          <ArabicText style={[styles.author, { fontSize: s.author }]} numberOfLines={1}>
            {author}
          </ArabicText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    overflow: "hidden",
    shadowColor: "#14181e",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
  chip: {
    position: "absolute",
    left: 8,
    top: 8,
    zIndex: 2,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: { color: "rgba(255,255,255,0.95)", fontWeight: "700", letterSpacing: 0.5 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  title: { color: "#ffffff", fontWeight: "700", textAlign: "center", lineHeight: undefined },
  author: { color: "rgba(255,255,255,0.75)", textAlign: "center" },
});
