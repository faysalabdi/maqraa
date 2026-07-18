import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StartTestResponse, SubmitTestResponse } from "@maqraa/shared";
import { ArabicText } from "../../../components/ArabicText";
import { Button, Input } from "../../../components/ui";
import { api } from "../../../lib/api";
import { fetchBookBySlug } from "../../../lib/data";
import { usePalette } from "../../../lib/use-palette";

export default function BookTest() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const c = usePalette();
  const [test, setTest] = useState<StartTestResponse | null>(null);
  const [bookId, setBookId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const [started, book] = await Promise.all([
          api<StartTestResponse>("/api/v1/tests/start", { body: { bookSlug: slug } }),
          fetchBookBySlug(slug),
        ]);
        setTest(started);
        setBookId(book?.id ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't start the test.");
      }
    })();
  }, [slug]);

  const submit = async () => {
    if (!test || !bookId) return;
    setBusy(true);
    try {
      const res = await api<SubmitTestResponse>(`/api/v1/tests/${test.testId}/submit`, {
        body: { bookId, answers },
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade the test.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Text style={{ color: c.danger, textAlign: "center", padding: 24 }}>{error}</Text>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!test) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={c.fgMuted} />
          </Pressable>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ color: c.fgMuted, marginTop: 12 }}>Preparing your test…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const resultById = result ? new Map(result.perQuestion.map((p) => [p.id, p])) : null;
  const answeredCount = test.questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={c.fgMuted} />
        </Pressable>
        <Text style={[styles.heading, { color: c.fg }]}>Comprehension test</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {test.isFallback && test.passageAr ? (
          <View style={[styles.passage, { backgroundColor: c.surface, borderColor: c.border }]}>
            <ArabicText style={{ color: c.fg, fontSize: 20, lineHeight: 36 }}>
              {test.passageAr}
            </ArabicText>
          </View>
        ) : null}

        {result ? (
          <View style={[styles.scoreCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.score, { color: result.passed ? c.brand : c.danger }]}>
              {result.score}%
            </Text>
            <Text style={{ color: c.fg, fontWeight: "600" }}>
              {result.passed ? "Passed — book complete" : "Not yet — 70% to pass"}
            </Text>
            {result.xpEarned > 0 ? (
              <Text style={{ color: c.accentFg }}>+{result.xpEarned} XP</Text>
            ) : null}
          </View>
        ) : null}

        {test.questions.map((q, qi) => {
          const graded = resultById?.get(q.id);
          const isMcq = q.choices && q.choices.length > 0;
          return (
            <View
              key={q.id}
              style={[styles.question, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <ArabicText style={[styles.prompt, { color: c.fg }]}>
                {qi + 1}. {q.prompt_ar}
              </ArabicText>

              {isMcq ? (
                q.choices!.map((choice, idx) => {
                  const selected = answers[q.id] === choice;
                  const isCorrect = graded && graded.correctAnswer.trim() === choice.trim();
                  const isWrongPick = graded && selected && graded.score < 1;
                  return (
                    <Pressable
                      key={idx}
                      disabled={!!result}
                      onPress={() => setAnswers((a) => ({ ...a, [q.id]: choice }))}
                      style={[
                        styles.choice,
                        {
                          borderColor: isCorrect
                            ? c.brand
                            : isWrongPick
                              ? c.danger
                              : selected
                                ? c.brand
                                : c.border,
                          backgroundColor: selected && !result ? `${c.brand}14` : "transparent",
                        },
                      ]}
                    >
                      <ArabicText style={{ color: c.fg, fontSize: 18, flex: 1 }}>
                        {choice}
                      </ArabicText>
                      {isCorrect ? (
                        <Ionicons name="checkmark-circle" size={20} color={c.brand} />
                      ) : null}
                      {isWrongPick ? (
                        <Ionicons name="close-circle" size={20} color={c.danger} />
                      ) : null}
                    </Pressable>
                  );
                })
              ) : (
                <Input
                  placeholder="اكتب إجابتك هنا"
                  multiline
                  editable={!result}
                  value={answers[q.id] ?? ""}
                  onChangeText={(t) => setAnswers((a) => ({ ...a, [q.id]: t }))}
                  style={{ minHeight: 80, textAlign: "right", fontSize: 18 }}
                />
              )}

              {graded ? (
                <View style={{ gap: 4 }}>
                  {graded.score < 1 ? (
                    <ArabicText style={{ color: c.fgMuted, fontSize: 16, lineHeight: 28 }}>
                      {graded.feedback_ar || graded.rationale_ar}
                    </ArabicText>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {result ? (
          <Button title="Done" onPress={() => router.back()} />
        ) : (
          <Button
            title={`Submit (${answeredCount}/${test.questions.length})`}
            onPress={submit}
            loading={busy}
            disabled={answeredCount !== test.questions.length}
          />
        )}
      </ScrollView>
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
  heading: { fontSize: 17, fontWeight: "700" },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  passage: { borderWidth: 1, borderRadius: 14, padding: 16 },
  scoreCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 4 },
  score: { fontSize: 40, fontWeight: "800" },
  question: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  prompt: { fontSize: 20, lineHeight: 34 },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
