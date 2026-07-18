import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tierFor } from "@maqraa/shared";
import { ArabicText } from "../../../components/ArabicText";
import { Button } from "../../../components/ui";
import {
  fetchBookBySlug,
  fetchChapterMetas,
  fetchChapterProgress,
  type Book,
  type ChapterMeta,
  type ChapterProgress,
} from "../../../lib/data";
import { useMe } from "../../../lib/me-context";
import { usePalette } from "../../../lib/use-palette";

export default function BookDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const c = usePalette();
  const { plan } = useMe();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [progress, setProgress] = useState<Map<string, ChapterProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const b = await fetchBookBySlug(slug);
      if (!b) {
        setError("Book not found");
        return;
      }
      const metas = await fetchChapterMetas(b.id);
      const prog = await fetchChapterProgress(metas.map((m) => m.id));
      setBook(b);
      setChapters(metas);
      setProgress(new Map(prog.map((p) => [p.chapter_id, p])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load this book.");
    }
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!book) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : <ActivityIndicator />}
        </View>
      </SafeAreaView>
    );
  }

  const locked = plan !== "pro" && tierFor(book.level) !== "Beginner";
  const doneCount = chapters.filter((ch) => progress.get(ch.id)?.status === "completed").length;
  const nextChapter =
    chapters.find((ch) => progress.get(ch.id)?.status !== "completed") ?? chapters[0];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={c.fg} />
        </Pressable>

        <ArabicText style={[styles.titleAr, { color: c.fg }]}>{book.title_ar}</ArabicText>
        <Text style={[styles.titleEn, { color: c.fgMuted }]}>
          {book.title_en}
          {book.author_en ? ` — ${book.author_en}` : ""}
        </Text>
        <Text style={[styles.blurb, { color: c.fgMuted }]}>{book.blurb}</Text>

        {locked ? (
          <View style={[styles.lockCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="lock-closed" size={20} color={c.accent} />
            <Text style={{ color: c.fg, flex: 1 }}>
              {tierFor(book.level)} books are part of Maqraa Pro.
            </Text>
          </View>
        ) : (
          <>
            {chapters.length > 0 && nextChapter ? (
              <Button
                title={doneCount === 0 ? "Start reading" : doneCount === chapters.length ? "Read again" : "Continue reading"}
                onPress={() =>
                  router.push(`/book/${book.slug}/read/${nextChapter.chapter_number}`)
                }
              />
            ) : null}
            <Button
              title="Whole-book test"
              variant="ghost"
              onPress={() => router.push(`/book/${book.slug}/test`)}
            />
          </>
        )}

        <View style={styles.chapterList}>
          <Text style={[styles.sectionTitle, { color: c.fg }]}>
            Chapters {chapters.length > 0 ? `(${doneCount}/${chapters.length})` : ""}
          </Text>
          {chapters.map((ch) => {
            const st = progress.get(ch.id)?.status;
            return (
              <Pressable
                key={ch.id}
                disabled={locked}
                onPress={() => router.push(`/book/${book.slug}/read/${ch.chapter_number}`)}
                style={({ pressed }) => [
                  styles.chapterRow,
                  { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : locked ? 0.5 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.chapterDot,
                    {
                      backgroundColor:
                        st === "completed" ? c.brand : st === "reading" ? c.accent : c.bgMuted,
                    },
                  ]}
                >
                  {st === "completed" ? (
                    <Ionicons name="checkmark" size={12} color={c.brandFg} />
                  ) : (
                    <Text style={{ color: c.fgMuted, fontSize: 11 }}>{ch.chapter_number}</Text>
                  )}
                </View>
                <ArabicText style={[styles.chapterTitle, { color: c.fg }]} numberOfLines={1}>
                  {ch.title_ar}
                </ArabicText>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  back: { marginBottom: 4 },
  titleAr: { fontSize: 32 },
  titleEn: { fontSize: 16 },
  blurb: { fontSize: 14, lineHeight: 21 },
  lockCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  chapterList: { gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  chapterDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterTitle: { flex: 1, fontSize: 18 },
});
