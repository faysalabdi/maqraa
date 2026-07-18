import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  COMMON_WORDS,
  cleanWord,
  isArabicWord,
  lookupKey,
  sectionize,
  type SaveWordRequest,
  type SaveWordResponse,
  type WordLookupResponse,
} from "@maqraa/shared";
import { ArabicText } from "../../../../components/ArabicText";
import { WordSheet, type WordInfo } from "../../../../components/WordSheet";
import { api } from "../../../../lib/api";
import {
  fetchBookBySlug,
  fetchCachedLookups,
  fetchChapter,
  fetchSavedWordKeys,
  type Book,
  type Chapter,
} from "../../../../lib/data";
import { usePalette } from "../../../../lib/use-palette";

// Reading tints mirror the web reader (Paper follows the app theme).
const TINTS = {
  sepia: { bg: "#f6efdc", ink: "#3a2f1c" },
  mint: { bg: "#e8f3ec", ink: "#1f3b30" },
} as const;
type Tint = "paper" | keyof typeof TINTS;

const SIZES = [18, 20, 22, 25, 28];
const PREFS_KEY = "reader-prefs";

export default function Reader() {
  const { slug, chapter: chapterParam } = useLocalSearchParams<{
    slug: string;
    chapter: string;
  }>();
  const chapterNumber = Number(chapterParam);
  const c = usePalette();

  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [word, setWord] = useState<WordInfo | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  const [savedLemmas, setSavedLemmas] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [sizeIdx, setSizeIdx] = useState(2);
  const [tint, setTint] = useState<Tint>("paper");
  const cacheRef = useRef<Map<string, WordInfo>>(new Map());
  const [finishing, setFinishing] = useState(false);

  // Reader prefs + already-saved words (underlined in the text).
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const prefs = JSON.parse(raw) as { sizeIdx?: number; tint?: Tint };
        if (typeof prefs.sizeIdx === "number") setSizeIdx(Math.min(SIZES.length - 1, Math.max(0, prefs.sizeIdx)));
        if (prefs.tint) setTint(prefs.tint);
      })
      .catch(() => {});
    fetchSavedWordKeys()
      .then((keys) => setSavedKeys(new Set(keys.map((k) => cleanWord(k)).filter(Boolean))))
      .catch(() => {});
  }, []);

  const setPrefs = useCallback((nextSize: number, nextTint: Tint) => {
    setSizeIdx(nextSize);
    setTint(nextTint);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ sizeIdx: nextSize, tint: nextTint })).catch(
      () => {},
    );
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!slug || !Number.isFinite(chapterNumber)) throw new Error("Bad route");
        const b = await fetchBookBySlug(slug);
        if (!b) throw new Error("Book not found");
        const ch = await fetchChapter(b.id, chapterNumber);
        if (!ch) throw new Error("Chapter not found");
        if (!alive) return;
        setBook(b);
        setChapter(ch);
        // Mark opened (book flips to in_progress on the path).
        api(`/api/v1/chapters/${ch.id}/read`, { body: { status: "reading" } }).catch(() => {});
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Couldn't open the chapter.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, chapterNumber]);

  const sections = useMemo(
    () => (chapter ? sectionize(chapter.content_ar) : []),
    [chapter],
  );

  // Warm the lookup cache for the visible page so taps are instant.
  useEffect(() => {
    const section = sections[page];
    if (!section) return;
    const keys = section.paragraphs
      .flatMap((p) => p.split(/\s+/))
      .map((w) => lookupKey(w))
      .filter((k) => k && !COMMON_WORDS[k] && !cacheRef.current.has(k));
    if (keys.length === 0) return;
    fetchCachedLookups(keys)
      .then((rows) => {
        for (const [key, row] of Object.entries(rows)) {
          cacheRef.current.set(key, {
            surface: row.key,
            surfaceKey: key,
            lemma_ar: row.lemma_ar,
            gloss_en: row.gloss_en,
            pos: row.pos,
            example_ar: row.example_ar,
          });
        }
      })
      .catch(() => {});
  }, [sections, page]);

  const openWord = useCallback(
    async (surface: string, context: string) => {
      const key = lookupKey(surface);
      if (!key || !isArabicWord(surface)) return;
      setWordError(null);

      const common = COMMON_WORDS[key];
      if (common) {
        setWord({
          surface,
          surfaceKey: key,
          lemma_ar: common.lemma_ar,
          gloss_en: common.gloss_en,
          pos: common.pos,
          example_ar: null,
        });
        return;
      }
      const cached = cacheRef.current.get(key);
      if (cached) {
        setWord({ ...cached, surface, surfaceKey: key });
        return;
      }

      setWordLoading(true);
      try {
        const lookup = await api<WordLookupResponse>("/api/v1/lookup", {
          body: { surface, context },
        });
        const info: WordInfo = {
          surface,
          surfaceKey: key,
          lemma_ar: lookup.lemma_ar,
          gloss_en: lookup.gloss_en,
          pos: lookup.pos,
          example_ar: lookup.example_ar,
        };
        cacheRef.current.set(key, info);
        setWord(info);
      } catch (e) {
        setWordError(e instanceof Error ? e.message : "Lookup failed.");
      } finally {
        setWordLoading(false);
      }
    },
    [],
  );

  const saveWord = useCallback(async () => {
    if (!word || !book || !chapter) return;
    await api<SaveWordResponse>("/api/v1/words", {
      body: {
        lemmaAr: word.lemma_ar,
        glossEn: word.gloss_en,
        exampleAr: word.example_ar,
        bookSlug: book.slug,
        chapterNumber: chapter.chapter_number,
        surfaceKey: word.surfaceKey,
      } satisfies SaveWordRequest,
    });
    setSavedLemmas((prev) => new Set(prev).add(word.lemma_ar));
    // Underline both the lemma and the tapped surface form, like the web reader.
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.add(cleanWord(word.lemma_ar));
      next.add(word.surfaceKey);
      return next;
    });
  }, [word, book, chapter]);

  const turnPage = useCallback(
    (dir: 1 | -1) => {
      setPage((p) => {
        const next = Math.min(Math.max(p + dir, 0), sections.length - 1);
        if (next !== p && dir === 1) {
          // Genuine reading activity: streak + small capped XP.
          api("/api/v1/reading/activity", { body: {} }).catch(() => {});
        }
        return next;
      });
    },
    [sections.length],
  );

  const finishChapter = useCallback(async () => {
    if (!chapter || !book) return;
    setFinishing(true);
    try {
      await api(`/api/v1/chapters/${chapter.id}/read`, { body: {} });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Chapter finished", "Nice work — keep the streak going.", [
        { text: "Take the quiz", onPress: () => router.replace(`/book/${book.slug}/quiz/${chapter.id}`) },
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Couldn't record the chapter", e instanceof Error ? e.message : "Try again.");
    } finally {
      setFinishing(false);
    }
  }, [chapter, book]);

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={{ color: c.danger }}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!chapter || sections.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  const section = sections[page];
  const lastPage = page === sections.length - 1;
  const pageBg = tint === "paper" ? c.readPage : TINTS[tint].bg;
  const ink = tint === "paper" ? c.fg : TINTS[tint].ink;
  const fontSize = SIZES[sizeIdx];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: pageBg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={c.fgMuted} />
        </Pressable>
        <View style={styles.tools}>
          <Pressable
            onPress={() => setPrefs(Math.max(0, sizeIdx - 1), tint)}
            hitSlop={8}
            disabled={sizeIdx === 0}
          >
            <Text style={[styles.sizeBtn, { color: sizeIdx === 0 ? c.locked : c.fgMuted }]}>A−</Text>
          </Pressable>
          <Pressable
            onPress={() => setPrefs(Math.min(SIZES.length - 1, sizeIdx + 1), tint)}
            hitSlop={8}
            disabled={sizeIdx === SIZES.length - 1}
          >
            <Text
              style={[
                styles.sizeBtn,
                { fontSize: 20, color: sizeIdx === SIZES.length - 1 ? c.locked : c.fgMuted },
              ]}
            >
              A+
            </Text>
          </Pressable>
          {(["paper", "sepia", "mint"] as Tint[]).map((t) => (
            <Pressable key={t} onPress={() => setPrefs(sizeIdx, t)} hitSlop={8}>
              <View
                style={[
                  styles.tintDot,
                  {
                    backgroundColor: t === "paper" ? c.readPage : TINTS[t].bg,
                    borderColor: tint === t ? c.brand : c.border,
                    borderWidth: tint === t ? 2.5 : 1,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
        <Text style={{ color: c.fgMuted, fontSize: 13 }}>
          {page + 1} / {sections.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.pageContent}>
        <ArabicText style={[styles.chapterTitle, { color: ink }]}>{chapter.title_ar}</ArabicText>
        {section.paragraphs.map((para, pi) => (
          <View key={pi} style={styles.paragraph}>
            {para.split(/\s+/).map((token, ti) => {
              const id = `${pi}-${ti}`;
              const key = cleanWord(token);
              const isSaved = !!key && savedKeys.has(key);
              const isSelected = selectedToken === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    setSelectedToken(id);
                    openWord(token, para.slice(0, 300));
                  }}
                >
                  <ArabicText
                    style={[
                      styles.token,
                      { color: ink, fontSize, lineHeight: fontSize * 2 },
                      isSaved && {
                        textDecorationLine: "underline",
                        textDecorationColor: c.brand,
                      },
                      isSelected && {
                        backgroundColor: `${c.brand}2e`,
                        borderRadius: 6,
                        color: c.brandDark,
                      },
                    ]}
                  >
                    {token}
                  </ArabicText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomBar, { borderTopColor: c.border }]}>
        <Pressable onPress={() => turnPage(-1)} disabled={page === 0} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={page === 0 ? c.locked : c.fg} />
        </Pressable>
        {lastPage ? (
          <Pressable
            onPress={finishChapter}
            disabled={finishing}
            style={[styles.finishButton, { backgroundColor: c.brand, opacity: finishing ? 0.6 : 1 }]}
          >
            <Text style={{ color: c.brandFg, fontWeight: "600" }}>
              {finishing ? "Saving…" : "Finish chapter"}
            </Text>
          </Pressable>
        ) : (
          <Text style={{ color: c.fgMuted, fontSize: 13 }}>Tap a word to translate</Text>
        )}
        <Pressable onPress={() => turnPage(1)} disabled={lastPage} hitSlop={10}>
          <Ionicons name="chevron-forward" size={26} color={lastPage ? c.locked : c.fg} />
        </Pressable>
      </View>

      <WordSheet
        word={word}
        loading={wordLoading}
        error={wordError}
        saved={!!word && savedLemmas.has(word.lemma_ar)}
        onSave={saveWord}
        onClose={() => {
          setWord(null);
          setWordError(null);
          setWordLoading(false);
          setSelectedToken(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pageContent: { paddingHorizontal: 24, paddingBottom: 24, gap: 18 },
  chapterTitle: { fontSize: 24, marginBottom: 6 },
  paragraph: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    columnGap: 6,
    rowGap: 2,
  },
  token: {},
  tools: { flexDirection: "row", alignItems: "center", gap: 12 },
  sizeBtn: { fontSize: 15, fontWeight: "700" },
  tintDot: { width: 22, height: 22, borderRadius: 11 },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  finishButton: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
});
