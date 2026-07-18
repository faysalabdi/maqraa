"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  gradeCardCore,
  practiceCardCore,
  type GradeResult,
  type PracticeResult,
} from "@/server/core/review";

export type { GradeResult, PracticeResult };

export async function gradeCard(itemId: string, quality: number): Promise<GradeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = await gradeCardCore({ id: user.id, email: user.email ?? null }, itemId, quality);
  if ("ok" in result) revalidatePath("/review");
  return result;
}

export async function practiceCard(itemId: string): Promise<PracticeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const result = await practiceCardCore({ id: user.id, email: user.email ?? null }, itemId);
  if ("ok" in result) revalidatePath("/review");
  return result;
}
