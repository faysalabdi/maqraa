"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  creditReadingActivityCore,
  getChapterQuizCore,
  markChapterReadCore,
  markChapterReadingCore,
  setBookNotReadingCore,
  submitChapterQuizCore,
  type ClientQuiz,
  type QuizResult,
} from "@/server/core/chapters";

export type { ClientQuiz, QuizResult };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { id: user.id, email: user.email ?? null };
}

export async function getChapterQuiz(chapterId: string): Promise<ClientQuiz> {
  const user = await requireUser();
  return getChapterQuizCore(user, chapterId);
}

export async function submitChapterQuiz(
  chapterId: string,
  answers: Record<string, number>,
): Promise<QuizResult> {
  const user = await requireUser();
  return submitChapterQuizCore(user, chapterId, answers);
}

export async function markChapterRead(chapterId: string): Promise<void> {
  const user = await requireUser();
  return markChapterReadCore(user, chapterId);
}

export async function markChapterReading(chapterId: string): Promise<void> {
  const user = await requireUser();
  return markChapterReadingCore(user, chapterId);
}

export async function setBookNotReading(bookId: string): Promise<void> {
  const user = await requireUser();
  await setBookNotReadingCore(user, bookId);
  revalidatePath("/path");
}

export async function creditReadingActivity(): Promise<void> {
  const user = await requireUser();
  return creditReadingActivityCore(user);
}
