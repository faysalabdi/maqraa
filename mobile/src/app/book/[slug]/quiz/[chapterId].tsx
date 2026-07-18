import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import type { ChapterQuizResponse, ChapterQuizSubmitResponse } from "@maqraa/shared";
import { ArabicText } from "../../../../components/ArabicText";
import { Button } from "../../../../components/ui";
import { api } from "../../../../lib/api";
import { usePalette } from "../../../../lib/use-palette";

export default function ChapterQuiz() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const c = usePalette();
  const [quiz, setQuiz] = useState<ChapterQuizResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ChapterQuizSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!chapterId) return;
    api<ChapterQuizResponse>(`/api/v1/chapters/${chapterId}/quiz`)
      .then(setQuiz)
      .catch((e) => setError(e.message));
  }, [chapterId]);

  const submit = async () => {
    if (!chapterId) return;
    setBusy(true);
    try {
      const res = await api<ChapterQuizSubmitResponse>(`/api/v1/chapters/${chapterId}/quiz`, {
        body: { answers },
      });
      Haptics.notificationAsync(
        res.score >= 70
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't grade the quiz.");
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

  if (!quiz) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ color: c.fgMuted, marginTop: 12 }}>Preparing your quiz…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const resultById = result ? new Map(result.perQuestion.map((p) => [p.id, p])) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={c.fgMuted} />
        </Pressable>
        <Text style={[styles.heading, { color: c.fg }]}>Chapter quiz</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {result ? (
          <View style={[styles.scoreCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.score, { color: result.score >= 70 ? c.brand : c.danger }]}>
              {Math.round(result.score)}%
            </Text>
            <Text style={{ color: c.fgMuted }}>
              {result.correctCount} of {result.total} correct
            </Text>
          </View>
        ) : null}

        {quiz.questions.map((q, qi) => {
          const graded = resultById?.get(q.id);
          return (
            <View
              key={q.id}
              style={[styles.question, { backgroundColor: c.surface, borderColor: c.border }]}
            >
              <ArabicText style={[styles.prompt, { color: c.fg }]}>
                {qi + 1}. {q.prompt_ar}
              </ArabicText>
              {q.choices.map((choice, idx) => {
                const selected = answers[q.id] === idx;
                const showCorrect = graded && graded.answerIndex === idx;
                const showWrong = graded && selected && !graded.correct;
                return (
                  <Pressable
                    key={idx}
                    disabled={!!result}
                    onPress={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                    style={[
                      styles.choice,
                      {
                        borderColor: showCorrect
                          ? c.brand
                          : showWrong
                            ? c.danger
                            : selected
                              ? c.brand
                              : c.border,
                        backgroundColor: selected && !result ? `${c.brand}14` : "transparent",
                      },
                    ]}
                  >
                    <ArabicText style={{ color: c.fg, fontSize: 18, flex: 1 }}>{choice}</ArabicText>
                    {showCorrect ? <Ionicons name="checkmark-circle" size={20} color={c.brand} /> : null}
                    {showWrong ? <Ionicons name="close-circle" size={20} color={c.danger} /> : null}
                  </Pressable>
                );
              })}
              {graded && !graded.correct && graded.rationaleAr ? (
                <ArabicText style={{ color: c.fgMuted, fontSize: 16, lineHeight: 28 }}>
                  {graded.rationaleAr}
                </ArabicText>
              ) : null}
            </View>
          );
        })}

        {result ? (
          <Button title="Done" onPress={() => router.back()} />
        ) : (
          <Button
            title="Submit"
            onPress={submit}
            loading={busy}
            disabled={Object.keys(answers).length !== quiz.questions.length}
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
