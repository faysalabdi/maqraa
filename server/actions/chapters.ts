"use server";

import { eq, and, count } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { getOrGenerateChapterQuiz, type ChapterQuiz } from "@/lib/ai/chapter-quiz";
import { grantXp, recordActivity } from "@/lib/xp/grant";
import { bookCompletionXp } from "@/lib/xp/rewards";
import { checkAndGrantAchievements } from "@/lib/achievements/check";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

export type ClientQuiz = {
  questions: { id: string; prompt_ar: string; choices: string[] }[];
};

export async function getChapterQuiz(chapterId: string): Promise<ClientQuiz> {
  await requireUser();

  const rows = await db
    .select({
      chapter: schema.bookChapters,
      level: schema.books.level,
    })
    .from(schema.bookChapters)
    .innerJoin(schema.books, eq(schema.bookChapters.bookId, schema.books.id))
    .where(eq(schema.bookChapters.id, chapterId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("chapter not found");

  const quiz = await getOrGenerateChapterQuiz(chapterId, row.chapter.contentAr, row.level);
  // Strip answers before sending to the client.
  return {
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt_ar: q.prompt_ar,
      choices: q.choices,
    })),
  };
}

export type QuizResult = {
  score: number;
  correctCount: number;
  total: number;
  perQuestion: { id: string; correct: boolean; answerIndex: number; rationaleAr: string }[];
};

export async function submitChapterQuiz(
  chapterId: string,
  answers: Record<string, number>,
): Promise<QuizResult> {
  const user = await requireUser();

  const quizRows = await db
    .select()
    .from(schema.chapterQuizzes)
    .where(eq(schema.chapterQuizzes.chapterId, chapterId))
    .limit(1);
  if (!quizRows[0]) throw new Error("quiz not generated");
  const quiz = quizRows[0].questions as ChapterQuiz;

  const perQuestion = quiz.questions.map((q) => ({
    id: q.id,
    correct: answers[q.id] === q.answer_index,
    answerIndex: q.answer_index,
    rationaleAr: q.rationale_ar,
  }));
  const correctCount = perQuestion.filter((p) => p.correct).length;
  const score = (correctCount / quiz.questions.length) * 100;

  await db
    .insert(schema.userChapterProgress)
    .values({
      userId: user.id,
      chapterId,
      status: "completed",
      quizScore: score.toFixed(2),
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.userChapterProgress.userId, schema.userChapterProgress.chapterId],
      set: { status: "completed", quizScore: score.toFixed(2), completedAt: new Date() },
    });

  await grantXp({
    userId: user.id,
    delta: 15,
    reason: "page_logged",
    refHash: `chapter_done:${chapterId}`,
    ref: { chapterId },
  });
  if (correctCount === quiz.questions.length) {
    await grantXp({
      userId: user.id,
      delta: 10,
      reason: "perfect_score",
      refHash: `chapter_perfect:${chapterId}`,
      ref: { chapterId },
    });
  }
  await recordActivity(user.id);

  return { score, correctCount, total: quiz.questions.length, perQuestion };
}

/**
 * Mark a chapter finished by reading it through (no quiz required). When every
 * chapter of the book is read, the book flips to reading_done so the forced
 * whole-book comprehension test unlocks.
 */
export async function markChapterRead(chapterId: string): Promise<void> {
  const user = await requireUser();

  await db
    .insert(schema.userChapterProgress)
    .values({ userId: user.id, chapterId, status: "completed", completedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.userChapterProgress.userId, schema.userChapterProgress.chapterId],
      set: { status: "completed", completedAt: new Date() },
    });

  await grantXp({
    userId: user.id,
    delta: 5,
    reason: "page_logged",
    refHash: `chapter_read:${chapterId}`,
    ref: { chapterId },
  });
  await recordActivity(user.id);

  const ch = await db
    .select({ bookId: schema.bookChapters.bookId })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.id, chapterId))
    .limit(1);
  if (!ch[0]) return;
  const bookId = ch[0].bookId;

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.bookId, bookId));
  const [{ done }] = await db
    .select({ done: count() })
    .from(schema.userChapterProgress)
    .innerJoin(schema.bookChapters, eq(schema.userChapterProgress.chapterId, schema.bookChapters.id))
    .where(
      and(
        eq(schema.bookChapters.bookId, bookId),
        eq(schema.userChapterProgress.userId, user.id),
        eq(schema.userChapterProgress.status, "completed"),
      ),
    );

  if (Number(done) >= Number(total)) {
    // Every chapter read — the book is complete. No test required; the whole-book
    // comprehension test stays available but optional.
    const updated = await db
      .update(schema.userBooks)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.bookId, bookId)))
      .returning({ bookId: schema.userBooks.bookId });
    if (updated.length === 0) {
      await db
        .insert(schema.userBooks)
        .values({ userId: user.id, bookId, status: "completed", startedAt: new Date(), completedAt: new Date() })
        .onConflictDoNothing();
    }

    // Completion XP, scaled by length and idempotent per book, then achievements.
    const [bk] = await db
      .select({ pages: schema.books.recommendedPages })
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);
    const xp = bookCompletionXp((bk?.pages ?? 100) * 250);
    if (xp > 0) {
      await grantXp({
        userId: user.id,
        delta: xp,
        reason: "book_completed",
        ref: { bookId },
        refHash: `book_completed:${bookId}`,
      });
    }
    await checkAndGrantAchievements(user.id);
  } else {
    await db
      .insert(schema.userBooks)
      .values({ userId: user.id, bookId, status: "in_progress", startedAt: new Date() })
      .onConflictDoNothing();
  }
}

export async function markChapterReading(chapterId: string): Promise<void> {
  const user = await requireUser();
  await db
    .insert(schema.userChapterProgress)
    .values({ userId: user.id, chapterId, status: "reading" })
    .onConflictDoNothing();

  // Also mark the parent book in_progress on the path.
  const ch = await db
    .select({ bookId: schema.bookChapters.bookId })
    .from(schema.bookChapters)
    .where(eq(schema.bookChapters.id, chapterId))
    .limit(1);
  if (ch[0]) {
    await db
      .insert(schema.userBooks)
      .values({ userId: user.id, bookId: ch[0].bookId, status: "in_progress", startedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.userBooks.userId, schema.userBooks.bookId],
        set: { updatedAt: new Date() },
      });
  }
}
