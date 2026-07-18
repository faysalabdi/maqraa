import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TIERS, tierFor, type Tier } from "@maqraa/shared";
import { AppHeader } from "../../components/AppHeader";
import { Washed } from "../../components/Background";
import { BookCard } from "../../components/BookCard";
import { ContinueCard } from "../../components/ContinueCard";
import { Serif } from "../../components/Serif";
import { cardShadow } from "../../lib/theme";
import { api } from "../../lib/api";
import {
  fetchCatalogue,
  fetchChapterMetas,
  fetchChapterProgress,
  fetchDueCount,
  fetchProfile,
  fetchStreak,
  fetchUserBooks,
  type Book,
  type Profile,
  type UserBook,
} from "../../lib/data";
import { useMe } from "../../lib/me-context";
import { useSession } from "../../lib/auth-context";
import { usePalette } from "../../lib/use-palette";

type ContinueInfo = { book: Book; done: number; total: number };

export default function PathScreen() {
  const c = usePalette();
  const { plan } = useMe();
  const { session } = useSession();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [userBooks, setUserBooks] = useState<UserBook[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [cont, setCont] = useState<ContinueInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [catalogue, mine, prof, strk, due] = await Promise.all([
        fetchCatalogue(),
        fetchUserBooks(),
        fetchProfile(),
        fetchStreak(),
        fetchDueCount(),
      ]);
      setBooks(catalogue);
      setUserBooks(mine);
      setProfile(prof);
      setStreak(strk?.current_days ?? 0);
      setDueCount(due);

      const reading = mine
        .filter((ub) => ub.status === "in_progress" || ub.status === "testing")
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      const contBook = reading.length ? catalogue.find((b) => b.id === reading[0].book_id) : null;
      if (contBook) {
        const metas = await fetchChapterMetas(contBook.id);
        const prog = await fetchChapterProgress(metas.map((m) => m.id));
        const done = prog.filter((p) => p.status === "completed").length;
        setCont({ book: contBook, done, total: metas.length });
      } else {
        setCont(null);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the library.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!books) {
    return (
      <Washed>
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
          </View>
        </SafeAreaView>
      </Washed>
    );
  }

  const byId = new Map(userBooks.map((ub) => [ub.book_id, ub]));
  const canRead = (book: Book) => plan === "pro" || tierFor(book.level) === "Beginner";

  const stopReading = async () => {
    if (!cont) return;
    setCont(null);
    try {
      await api(`/api/v1/books/${cont.book.id}/not-reading`, { body: {} });
      load();
    } catch {
      load();
    }
  };

  const continueToReader = () => {
    if (!cont) return;
    router.push(`/book/${cont.book.slug}`);
  };

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        >
          <View style={styles.topLine}>
            <Text style={[styles.eyebrow, { color: c.fgMuted }]}>{dayLabel()} · READ</Text>
            <View style={styles.chips}>
              <Chip icon="flame" tint={c.flame} value={streak} filled />
              <Chip icon="flash" tint={c.accent} value={profile?.xp_total ?? 0} filled />
            </View>
          </View>
          <Serif style={[styles.heading, { color: c.fg }]}>Read</Serif>

          {cont ? (
            <ContinueCard
              book={cont.book}
              chaptersDone={cont.done}
              chaptersTotal={cont.total}
              onPlay={continueToReader}
              onStop={stopReading}
            />
          ) : null}

          <LibraryCard hasBooks={books.some((b) => b.owner_id)} plan={plan} />

          {books.some((b) => b.owner_id) ? (
            <Shelf
              tier="Your library"
              books={books.filter((b) => b.owner_id)}
              locked={false}
              byId={byId}
              canRead={() => true}
            />
          ) : null}

          {TIERS.map((tier) => {
            const shelf = books.filter((b) => !b.owner_id && tierFor(b.level) === tier);
            if (shelf.length === 0) return null;
            const done = shelf.filter((b) => byId.get(b.id)?.status === "completed").length;
            return (
              <Shelf
                key={tier}
                tier={tier}
                subtitle={`${done} OF ${shelf.length} FINISHED`}
                books={shelf}
                locked={plan !== "pro" && tier !== "Beginner"}
                byId={byId}
                canRead={canRead}
              />
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Washed>
  );
}

function dayLabel(): string {
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date().getDay()];
}

function LibraryCard({ hasBooks, plan }: { hasBooks: boolean; plan: "free" | "pro" }) {
  const c = usePalette();
  return (
    <Pressable
      onPress={() => router.push(plan === "pro" ? "/upload" : "/paywall")}
      accessibilityRole="button"
      accessibilityLabel="Your library — add your own book"
      style={({ pressed }) => [
        styles.libraryCard,
        cardShadow,
        { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.libraryIcon, { backgroundColor: `${c.brand}22` }]}>
        <Ionicons name="library" size={22} color={c.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.libraryTitle, { color: c.fg }]}>Your library</Text>
        <Text style={{ color: c.fgMuted, fontSize: 13 }} numberOfLines={2}>
          {hasBooks
            ? "Add another book — drop an EPUB to your shelf."
            : "Bring your own books — drop an EPUB to add it to your shelf."}
        </Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={c.fgMuted} />
    </Pressable>
  );
}

function Chip({
  icon,
  tint,
  value,
  filled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: number;
  filled?: boolean;
}) {
  const c = usePalette();
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: filled ? `${tint}22` : "transparent",
          borderColor: filled ? "transparent" : c.border,
        },
      ]}
    >
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={{ color: c.fg, fontWeight: "700", fontSize: 13 }}>{value}</Text>
    </View>
  );
}

function Shelf({
  tier,
  subtitle,
  books,
  locked,
  byId,
  canRead,
}: {
  tier: Tier | "Your library";
  subtitle?: string;
  books: Book[];
  locked: boolean;
  byId: Map<string, { status: string }>;
  canRead: (b: Book) => boolean;
}) {
  const c = usePalette();
  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeader}>
        <Text style={[styles.shelfTitle, { color: c.fg }]}>{tier}</Text>
        {subtitle ? <Text style={[styles.shelfSub, { color: c.fgMuted }]}>{subtitle}</Text> : null}
        {locked ? <Text style={{ color: c.fgMuted, fontSize: 13 }}>Pro</Text> : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.shelfRow}
      >
        {books.map((book) => {
          const bookLocked = !canRead(book);
          return (
            <BookCard
              key={book.id}
              book={book}
              locked={bookLocked}
              completed={byId.get(book.id)?.status === "completed"}
              onPress={() =>
                bookLocked ? router.push("/paywall") : router.push(`/book/${book.slug}`)
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  heading: { fontSize: 38, marginTop: -6, marginBottom: 2 },
  chips: { flexDirection: "row", gap: 7 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  libraryIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  libraryTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  shelf: { gap: 12 },
  shelfHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  shelfTitle: { fontSize: 22, fontWeight: "800" },
  shelfSub: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  shelfRow: { gap: 14 },
});
