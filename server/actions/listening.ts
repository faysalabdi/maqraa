"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import {
  getOrGenerateListeningExercise,
  ListeningQuestionSchema,
} from "@/lib/ai/listening";
import { grantXp, recordActivity } from "@/lib/xp/grant";
import { logEvent } from "@/lib/analytics";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user;
}

export type ClientListeningExercise = {
  id: string;
  topic: string;
  passageAr: string;
  questions: { id: string; prompt_ar: string; choices: string[] }[];
};

export async function getListeningExercise(): Promise<ClientListeningExercise> {
  const user = await requireUser();
  const profile = await db
    .select({ currentLevel: schema.profiles.currentLevel })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1);
  const level = profile[0]?.currentLevel ?? 1;

  const ex = await getOrGenerateListeningExercise(level);
  // Answers stay server-side.
  return {
    id: ex.id,
    topic: ex.topic,
    passageAr: ex.passage_ar,
    questions: ex.questions.map((q) => ({
      id: q.id,
      prompt_ar: q.prompt_ar,
      choices: q.choices,
    })),
  };
}

export type ListeningResult = {
  correctCount: number;
  total: number;
  passed: boolean;
  perQuestion: { id: string; correct: boolean; answerIndex: number; rationaleAr: string }[];
  xpEarned: number;
};

export async function submitListening(
  exerciseId: string,
  answers: Record<string, number>,
): Promise<ListeningResult> {
  const user = await requireUser();

  const rows = await db
    .select()
    .from(schema.listeningExercises)
    .where(eq(schema.listeningExercises.id, exerciseId))
    .limit(1);
  if (!rows[0]) throw new Error("exercise not found");

  const questions = z.array(ListeningQuestionSchema).parse(rows[0].questions);
  const perQuestion = questions.map((q) => ({
    id: q.id,
    correct: answers[q.id] === q.answer_index,
    answerIndex: q.answer_index,
    rationaleAr: q.rationale_ar,
  }));
  const correctCount = perQuestion.filter((p) => p.correct).length;
  const passed = correctCount >= 2;

  let xpEarned = 0;
  if (passed) {
    xpEarned = await grantXp({
      userId: user.id,
      delta: correctCount === questions.length ? 15 : 10,
      reason: "listening_passed",
      ref: { exerciseId, correctCount },
      refHash: `listen:${exerciseId}:${user.id}`,
    });
    await recordActivity(user.id);
  }

  await logEvent("listening_submitted", { exerciseId, correctCount, passed });

  return { correctCount, total: questions.length, passed, perQuestion, xpEarned };
}
