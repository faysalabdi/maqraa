import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
  const name = (profile?.display_name || session?.user.email?.split("@")[0] || "").trim();
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
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {name ? (
                <Text style={[styles.welcome, { color: c.fgMuted }]}>
                  WELCOME BACK, {name.toUpperCase()}
                </Text>
              ) : null}
              <Text style={[styles.heading, { color: c.fg }]}>Read</Text>
            </View>
            <View style={styles.chips}>
              <Chip icon="flame" tint={c.flame} value={streak} filled />
              <Chip icon="sparkles" tint={c.brand} value={profile?.xp_total ?? 0} />
              <Chip icon="checkbox" tint={c.fgMuted} value={dueCount} />
            </View>
          </View>

          {cont ? (
            <ContinueCard
              book={cont.book}
              chaptersDone={cont.done}
              chaptersTotal={cont.total}
              onPlay={continueToReader}
              onStop={stopReading}
            />
          ) : null}

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
  content: { padding: 20, gap: 22, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  welcome: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heading: { fontSize: 32, fontWeight: "800", marginTop: 2 },
  chips: { flexDirection: "row", gap: 7, marginBottom: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  shelf: { gap: 12 },
  shelfHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  shelfTitle: { fontSize: 22, fontWeight: "800" },
  shelfSub: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  shelfRow: { gap: 14 },
});
