"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, and, count } from "drizzle-orm";
import { type GeneratedTest } from "@/lib/ai/test-generator";
import { anthropic, FALLBACK_MODEL } from "@/lib/ai/anthropic";
import { grantXp, recordActivity } from "@/lib/xp/grant";
import { XP_REWARDS, testPassedXp, bookCompletionXp } from "@/lib/xp/rewards";
import { checkAndGrantAchievements } from "@/lib/achievements/check";
import { z } from "zod";
import type { PerQuestionResult, SubmitResult } from "./test-types";

// ── Grading ───────────────────────────────────────────────────────────────────

const GradeSchema = z.object({
  grades: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(1),
      feedback_ar: z.string(),
    }),
  ),
});

const GRADE_TOOL = {
  name: "grade_answers",
  description: "Grade open-ended Arabic comprehension answers against model answers.",
  input_schema: {
    type: "object",
    properties: {
      grades: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            score: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "0 = wrong, 0.5 = partially correct, 1 = correct",
            },
            feedback_ar: {
              type: "string",
              description: "One sentence Arabic feedback.",
            },
          },
          required: ["id", "score", "feedback_ar"],
        },
      },
    },
    required: ["grades"],
  },
} as const;

async function gradeOpenEnded(
  toGrade: Array<{ id: string; prompt_ar: string; answer: string; userAnswer: string }>,
): Promise<z.infer<typeof GradeSchema>["grades"]> {
  if (toGrade.length === 0) return [];

  const items = toGrade
    .map(
      (q) =>
        `Q${q.id}: ${q.prompt_ar}\nModel answer: ${q.answer}\nUser answer: ${q.userAnswer}`,
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: FALLBACK_MODEL,
    max_tokens: 1024,
    system:
      "You grade Arabic comprehension answers. For each question, score 0 (wrong), 0.5 (partial), or 1 (correct). Write brief Arabic feedback.",
    tools: [GRADE_TOOL as never],
    tool_choice: { type: "tool", name: "grade_answers" },
    messages: [{ role: "user", content: items }],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use")
    return toGrade.map((q) => ({ id: q.id, score: 0, feedback_ar: "" }));

  const parsed = GradeSchema.safeParse(toolUse.input);
  if (!parsed.success)
    return toGrade.map((q) => ({ id: q.id, score: 0, feedback_ar: "" }));
  return parsed.data.grades;
}

// ── Submit ────────────────────────────────────────────────────────────────────

export async function submitAttempt(
  testId: string,
  bookId: string,
  bookSlug: string,
  answers: Record<string, string>,
): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [testRow] = await db
    .select()
    .from(schema.comprehensionTests)
    .where(eq(schema.comprehensionTests.id, testId))
    .limit(1);
  if (!testRow) return { error: "Test not found" };

  const book = await db
    .select()
    .from(schema.books)
    .where(eq(schema.books.id, bookId))
    .limit(1)
    .then((r) => r[0]);
  if (!book) return { error: "Book not found" };

  const raw = testRow.questions;
  const questions: GeneratedTest["questions"] = Array.isArray(raw)
    ? (raw as GeneratedTest["questions"])
    : (raw as { questions: GeneratedTest["questions"] }).questions;

  const openEndedQueue: Array<{
    id: string;
    prompt_ar: string;
    answer: string;
    userAnswer: string;
  }> = [];
  const autoGrades = new Map<string, { score: number; feedback_ar: string }>();

  for (const q of questions) {
    const userAnswer = answers[q.id] ?? "";
    if (q.choices && q.choices.length > 0) {
      const correct = userAnswer.trim() === q.answer.trim();
      autoGrades.set(q.id, {
        score: correct ? 1 : 0,
        feedback_ar: correct ? "إجابة صحيحة" : `الإجابة الصحيحة: ${q.answer}`,
      });
    } else {
      openEndedQueue.push({ id: q.id, prompt_ar: q.prompt_ar, answer: q.answer, userAnswer });
    }
  }

  const openGrades = await gradeOpenEnded(openEndedQueue);
  const openGradeMap = new Map(openGrades.map((g) => [g.id, g]));

  const perQuestion: PerQuestionResult[] = questions.map((q) => {
    const userAnswer = answers[q.id] ?? "";
    const graded =
      autoGrades.get(q.id) ?? openGradeMap.get(q.id) ?? { score: 0, feedback_ar: "" };
    return {
      id: q.id,
      type: q.type,
      prompt_ar: q.prompt_ar,
      userAnswer,
      correctAnswer: q.answer,
      rationale_ar: q.rationale_ar,
      score: graded.score,
      feedback_ar: graded.feedback_ar,
      vocab_lemma: q.vocab_lemma,
    };
  });

  const totalScore = perQuestion.reduce((sum, r) => sum + r.score, 0);
  const scorePercent = Math.round((totalScore / questions.length) * 100);
  const passed = scorePercent >= 70;

  await db.insert(schema.comprehensionAttempts).values({
    testId,
    userId: user.id,
    bookId,
    answers,
    score: scorePercent.toString(),
    passed,
    perQuestion,
  });

  const [currentUserBook] = await db
    .select()
    .from(schema.userBooks)
    .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)))
    .limit(1);

  const prevBest = currentUserBook?.bestScore ? Number(currentUserBook.bestScore) : 0;
  const newBest = Math.max(prevBest, scorePercent);
  const nextAttempts = (currentUserBook?.attempts ?? 0) + 1;

  if (passed) {
    await db
      .update(schema.userBooks)
      .set({
        status: "completed",
        completedAt: currentUserBook?.completedAt ?? new Date(),
        bestScore: newBest.toString(),
        attempts: nextAttempts,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)));
  } else {
    // The test is optional now; failing it must not un-complete a book the
    // reader already finished by reading it through.
    await db
      .update(schema.userBooks)
      .set({
        status: currentUserBook?.status === "completed" ? "completed" : "failed_retry",
        bestScore: newBest.toString(),
        attempts: nextAttempts,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)));
  }

  let xpEarned = 0;
  const attemptRef = { testId, bookId };

  if (passed) {
    const passXp = testPassedXp(book.difficulty);
    xpEarned += await grantXp({
      userId: user.id,
      delta: passXp,
      reason: "test_passed",
      ref: attemptRef,
      refHash: `test_passed:${testId}`,
    });

    if (scorePercent === 100) {
      xpEarned += await grantXp({
        userId: user.id,
        delta: XP_REWARDS.perfectScoreBonus,
        reason: "perfect_score",
        ref: attemptRef,
        refHash: `perfect:${testId}`,
      });
    }

    const estimatedWords = (book.recommendedPages ?? 100) * 250;
    const completionXp = bookCompletionXp(estimatedWords);
    if (completionXp > 0) {
      xpEarned += await grantXp({
        userId: user.id,
        delta: completionXp,
        reason: "book_completed",
        ref: { bookId },
        refHash: `book_completed:${bookId}`,
      });
    }
  }

  await seedWrongVocab(user.id, perQuestion, bookId);
  await recordActivity(user.id);
  await checkAndGrantAchievements(user.id);
  revalidatePath(`/book/${bookSlug}`);
  revalidatePath("/path");

  return {
    ok: true,
    score: scorePercent,
    passed,
    xpEarned,
    perQuestion,
    newLevel: null,
  };
}

async function seedWrongVocab(
  userId: string,
  perQuestion: PerQuestionResult[],
  bookId: string,
) {
  const wrongVocab = perQuestion.filter(
    (q) => q.type === "vocab" && q.score < 1 && q.vocab_lemma,
  );

  for (const q of wrongVocab) {
    if (!q.vocab_lemma) continue;
    try {
      await db.insert(schema.vocabItems).values({
        userId,
        lemmaAr: q.vocab_lemma,
        glossEn: q.correctAnswer,
        exampleAr: q.prompt_ar,
        source: "test_wrong",
        sourceRef: { bookId, questionId: q.id },
      });
    } catch {
      // unique(userId, lemmaAr) — already in deck
    }
  }
}
