import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TIERS, tierFor, type Tier } from "@maqraa/shared";
import { ArabicText } from "../../components/ArabicText";
import { BookCard } from "../../components/BookCard";
import { fetchCatalogue, fetchUserBooks, type Book, type UserBook } from "../../lib/data";
import { useMe } from "../../lib/me-context";
import { purchasesAvailable } from "../../lib/purchases";
import { usePalette } from "../../lib/use-palette";

export default function PathScreen() {
  const c = usePalette();
  const { plan } = useMe();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [userBooks, setUserBooks] = useState<UserBook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [catalogue, mine] = await Promise.all([fetchCatalogue(), fetchUserBooks()]);
      setBooks(catalogue);
      setUserBooks(mine);
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
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <View style={styles.center}>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </SafeAreaView>
    );
  }

  const byId = new Map(userBooks.map((ub) => [ub.book_id, ub]));
  const reading = userBooks
    .filter((ub) => ub.status === "in_progress" || ub.status === "testing")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const continueBook = reading.length > 0 ? books.find((b) => b.id === reading[0].book_id) : null;

  const canRead = (book: Book) => plan === "pro" || tierFor(book.level) === "Beginner";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top"]}>
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
        <View style={styles.header}>
          <Text style={[styles.heading, { color: c.fg }]}>Read</Text>
          <ArabicText style={[styles.headingAr, { color: c.brand }]}>مقرأة</ArabicText>
        </View>

        {continueBook ? (
          <Pressable
            onPress={() => router.push(`/book/${continueBook.slug}`)}
            style={({ pressed }) => [
              styles.hero,
              { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.heroLabel, { color: c.brand }]}>Continue reading</Text>
              <ArabicText style={[styles.heroTitle, { color: c.fg }]} numberOfLines={1}>
                {continueBook.title_ar}
              </ArabicText>
              <Text style={{ color: c.fgMuted, fontSize: 13 }} numberOfLines={1}>
                {continueBook.title_en}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {TIERS.map((tier) => {
          const shelf = books.filter((b) => tierFor(b.level) === tier);
          if (shelf.length === 0) return null;
          return (
            <Shelf
              key={tier}
              tier={tier}
              books={shelf}
              locked={plan !== "pro" && tier !== "Beginner"}
              byId={byId}
              canRead={canRead}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Shelf({
  tier,
  books,
  locked,
  byId,
  canRead,
}: {
  tier: Tier;
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
        {locked ? <Text style={{ color: c.fgMuted, fontSize: 13 }}>Pro</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
        {books.map((book) => {
          const bookLocked = !canRead(book);
          return (
            <BookCard
              key={book.id}
              book={book}
              locked={bookLocked}
              completed={byId.get(book.id)?.status === "completed"}
              onPress={() =>
                bookLocked && purchasesAvailable()
                  ? router.push("/paywall")
                  : router.push(`/book/${book.slug}`)
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 30, fontWeight: "700" },
  headingAr: { fontSize: 26 },
  hero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  heroLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  heroTitle: { fontSize: 22 },
  shelf: { gap: 10 },
  shelfHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  shelfTitle: { fontSize: 20, fontWeight: "700" },
  shelfRow: { gap: 12 },
});
