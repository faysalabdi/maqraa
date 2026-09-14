import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  answer,
  buildChoices,
  createSession,
  currentCard,
  currentMode,
  isDone,
  progress,
  qualityFor,
  type GradeCardResponse,
  type PracticeCardResponse,
  type ReviewSession,
} from "@maqraa/shared";
import { ArabicText } from "../../components/ArabicText";
import { Washed } from "../../components/Background";
import { Confetti } from "../../components/Confetti";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { celebrate, hasConfetti } from "../../lib/celebrate";
import {
  fetchDueVocab,
  fetchPracticeVocab,
  type VocabItem,
} from "../../lib/data";
import { centeredContent } from "../../lib/theme";
import { usePalette } from "../../lib/use-palette";

// UI grades → SM-2 quality (same mapping as the web review page).
const GRADES = [
  { label: "Again", quality: 1, tone: "danger" },
  { label: "Hard", quality: 3, tone: "warn" },
  { label: "Good", quality: 4, tone: "brand" },
  { label: "Easy", quality: 5, tone: "iris" },
] as const;

type Choice = { id: string; gloss: string };

export default function ReviewScreen() {
  const c = usePalette();
  const { mode: routeMode } = useLocalSearchParams<{ mode?: string }>();
  const practice = routeMode === "practice";

  const [deck, setDeck] = useState<VocabItem[] | null>(null);
  const [pool, setPool] = useState<Choice[]>([]);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const sessionRef = useRef(0);

  const reload = useCallback(() => {
    sessionRef.current += 1;
    setDeck(null);
    setSession(null);
    setRevealed(false);
    setPicked(null);
    setXpTotal(0);
    setError(null);
    setPendingCount(0);
    setSyncError(null);
    // The wider set is only ever used for wrong answers, so a failure there
    // must not take the session down with it.
    Promise.all([
      practice ? fetchPracticeVocab() : fetchDueVocab(),
      fetchPracticeVocab().catch(() => [] as VocabItem[]),
    ])
      .then(([due, wider]) => {
        const cards = practice ? due.slice(0, 20) : due;
        setDeck(cards);
        setSession(createSession(cards.map((x) => x.id)));
        const merged = new Map<string, Choice>();
        for (const item of [...cards, ...wider]) {
          merged.set(item.id, { id: item.id, gloss: item.gloss_en });
        }
        setPool([...merged.values()]);
      })
      .catch((e) => setError(e.message));
  }, [practice]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!syncError) return;
    const t = setTimeout(() => setSyncError(null), 4000);
    return () => clearTimeout(t);
  }, [syncError]);

  const byId = useMemo(() => {
    const map: Record<string, VocabItem> = {};
    for (const item of deck ?? []) map[item.id] = item;
    return map;
  }, [deck]);

  const card = session ? currentCard(session) : null;
  const mode = session ? currentMode(session) : null;
  const item = card ? byId[card.id] : null;
  // Options must stay put while the reader is looking at them, so they are
  // rebuilt only when a different presentation comes up.
  const presentation = card ? `${card.id}:${card.attempts}` : "";
  const [choices, setChoices] = useState<{ key: string; options: Choice[] }>({
    key: "",
    options: [],
  });

  useEffect(() => {
    if (!item || mode !== "choice") return;
    setChoices({
      key: presentation,
      options: buildChoices(pool, { id: item.id, gloss: item.gloss_en }, 4),
    });
  }, [presentation, mode, item, pool]);

  // Fire the payoff once on the transition into a finished session, not on
  // every render while the done screen is up.
  const finished = session !== null && isDone(session);
  const sessionTotal = session?.total ?? 0;
  const [burst, setBurst] = useState(0);
  const celebratedDone = useRef(false);
  useEffect(() => {
    if (!finished) {
      celebratedDone.current = false;
      return;
    }
    if (celebratedDone.current || sessionTotal === 0) return;
    celebratedDone.current = true;
    celebrate("session-complete");
    if (hasConfetti("session-complete")) setBurst((n) => n + 1);
  }, [finished, sessionTotal]);

  const syncGrade = (cardId: string, quality: number) => {
    const run = sessionRef.current;
    setPendingCount((n) => n + 1);
    (practice
      ? api<PracticeCardResponse>(`/api/v1/review/${cardId}/practice`, { body: {} })
      : api<GradeCardResponse>(`/api/v1/review/${cardId}/grade`, { body: { quality } })
    )
      .then((res) => {
        if (sessionRef.current !== run) return;
        setXpTotal((x) => x + res.xpEarned);
      })
      .catch(() => {
        if (sessionRef.current !== run) return;
        setSyncError("Some cards didn't sync — they'll show up again next time.");
      })
      .finally(() => {
        if (sessionRef.current !== run) return;
        setPendingCount((n) => n - 1);
      });
  };

  /**
   * A pass masters the word and is the only thing reported to the server —
   * one quality per card per session. A miss just puts it back in the queue;
   * nothing is sent, so an abandoned session leaves it due as it was.
   */
  const resolve = (passed: boolean, selfGrade?: number) => {
    if (!session || !card) return;
    celebrate(passed ? "answer-correct" : "answer-missed");
    if (passed) syncGrade(card.id, qualityFor(card, selfGrade));
    setSession(answer(session, passed));
    setRevealed(false);
    setPicked(null);
  };

  const toneColor = (tone: (typeof GRADES)[number]["tone"]) =>
    tone === "danger" ? c.danger : tone === "warn" ? c.accent : tone === "iris" ? c.iris : c.brand;

  const stats = session ? progress(session) : null;

  return (
    <Washed>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={[styles.topBar, centeredContent]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={26} color={c.fg} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: c.fg }]}>
              {practice ? "Practice" : "Review"}
            </Text>
          </View>
          <Text style={{ color: c.fgMuted }}>
            {stats ? `${stats.mastered} / ${stats.total}` : ""}
            {xpTotal > 0 ? ` · +${xpTotal} XP` : ""}
          </Text>
        </View>

        {stats && !finished ? (
          <View style={[styles.progressWrap, centeredContent]}>
            <View style={[styles.progressTrack, { backgroundColor: c.bgMuted }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: c.brand, width: `${Math.round(stats.fraction * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressHint, { color: c.fgMuted }]}>
              {stats.remaining} left · missed words come back
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.center}>
            <Text style={{ color: c.danger, textAlign: "center", padding: 24 }}>{error}</Text>
            <Button title="Try again" variant="ghost" onPress={reload} />
          </View>
        ) : !session || !deck ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : finished ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={48} color={c.brand} />
            <Text style={[styles.doneTitle, { color: c.fg }]}>
              {stats && stats.total > 0 ? "Session complete" : "Nothing due"}
            </Text>
            <Text style={{ color: c.fgMuted, textAlign: "center", paddingHorizontal: 24 }}>
              {stats && stats.total > 0
                ? `${stats.total} word${stats.total === 1 ? "" : "s"} mastered · +${xpTotal} XP`
                : "Come back later."}
            </Text>
            {pendingCount > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" />
                <Text style={{ color: c.fgMuted }}>Syncing…</Text>
              </View>
            ) : null}
            {syncError ? (
              <Text style={{ color: c.danger, textAlign: "center", paddingHorizontal: 24 }}>
                {syncError}
              </Text>
            ) : null}
            {stats && stats.total > 0 ? (
              <Button title={practice ? "Practice more" : "Review again"} onPress={reload} />
            ) : (
              <Button title="Back to books" variant="ghost" onPress={() => router.push("/path")} />
            )}
          </View>
        ) : !item ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={[styles.body, centeredContent]}>
            {syncError ? (
              <Text style={{ color: c.danger, textAlign: "center" }}>{syncError}</Text>
            ) : null}

            {card && card.attempts > 0 ? (
              <View style={[styles.retryChip, { backgroundColor: `${c.accent}22` }]}>
                <Ionicons name="repeat" size={13} color={c.accentFg} />
                <Text style={{ color: c.accentFg, fontSize: 12, fontWeight: "700" }}>
                  Back again — this time as multiple choice
                </Text>
              </View>
            ) : null}

            {mode === "choice" ? (
              <ChoicePrompt
                item={item}
                options={choices.key === presentation ? choices.options : []}
                picked={picked}
                onPick={setPicked}
                onNext={(correct) => resolve(correct)}
                palette={c}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => setRevealed(true)}
                  style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <ArabicText style={[styles.lemma, { color: c.fg }]}>{item.lemma_ar}</ArabicText>
                  {revealed ? (
                    <>
                      <Text style={[styles.gloss, { color: c.fg }]}>{item.gloss_en}</Text>
                      {item.example_ar ? (
                        <ArabicText style={[styles.example, { color: c.fgMuted }]}>
                          {item.example_ar}
                        </ArabicText>
                      ) : null}
                    </>
                  ) : (
                    <Text style={{ color: c.fgMuted }}>Tap to reveal</Text>
                  )}
                </Pressable>

                {revealed ? (
                  <View style={styles.gradeRow}>
                    {GRADES.map((g) => (
                      <Pressable
                        key={g.label}
                        onPress={() => resolve(g.quality >= 3, g.quality)}
                        style={({ pressed }) => [
                          styles.gradeButton,
                          { backgroundColor: toneColor(g.tone) },
                          pressed && styles.gradeButtonPressed,
                        ]}
                      >
                        <Text style={{ color: "#ffffff", fontWeight: "700" }}>{g.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        )}
        {burst > 0 ? <Confetti key={burst} /> : null}
      </SafeAreaView>
    </Washed>
  );
}

function ChoicePrompt({
  item,
  options,
  picked,
  onPick,
  onNext,
  palette: c,
}: {
  item: VocabItem;
  options: Choice[];
  picked: string | null;
  onPick: (id: string) => void;
  onNext: (correct: boolean) => void;
  palette: ReturnType<typeof usePalette>;
}) {
  const answered = picked !== null;
  const correct = picked === item.id;

  return (
    <>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <ArabicText style={[styles.lemma, { color: c.fg }]}>{item.lemma_ar}</ArabicText>
        {item.example_ar ? (
          <ArabicText style={[styles.example, { color: c.fgMuted, fontSize: 17, lineHeight: 30 }]}>
            {item.example_ar}
          </ArabicText>
        ) : null}
        <Text style={{ color: c.fgMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1 }}>
          WHAT DOES THIS MEAN?
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {options.map((option) => {
          const isAnswer = option.id === item.id;
          const isPicked = option.id === picked;
          const background = !answered
            ? c.surface
            : isAnswer
              ? `${c.brand}1f`
              : isPicked
                ? `${c.danger}1f`
                : c.surface;
          const border = !answered
            ? c.border
            : isAnswer
              ? c.brand
              : isPicked
                ? c.danger
                : c.border;
          return (
            <Pressable
              key={option.id}
              disabled={answered}
              onPress={() => onPick(option.id)}
              style={[
                styles.option,
                { backgroundColor: background, borderColor: border, opacity: answered && !isAnswer && !isPicked ? 0.5 : 1 },
              ]}
            >
              <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600", flex: 1 }}>
                {option.gloss}
              </Text>
              {answered && isAnswer ? (
                <Ionicons name="checkmark-circle" size={20} color={c.brand} />
              ) : answered && isPicked ? (
                <Ionicons name="close-circle" size={20} color={c.danger} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <Button
          title={correct ? "Next" : "Got it — keep going"}
          onPress={() => onNext(correct)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 30, fontWeight: "700" },
  progressWrap: { paddingHorizontal: 20, paddingBottom: 4, gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressHint: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  doneTitle: { fontSize: 22, fontWeight: "700" },
  body: { flex: 1, padding: 20, gap: 16, justifyContent: "center" },
  retryChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 14,
    minHeight: 220,
    justifyContent: "center",
  },
  lemma: { fontSize: 40, textAlign: "center" },
  gloss: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  example: { fontSize: 20, lineHeight: 34, textAlign: "center" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 18,
    minHeight: 56,
  },
  gradeRow: { flexDirection: "row", gap: 10 },
  gradeButton: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeButtonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.96 }],
  },
});
