"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { rate, SRS_GRADUATED_INTERVAL_DAYS } from "@/lib/srs/sm2";
import { grantXp, todayXp, recordActivity } from "@/lib/xp/grant";
import { XP_REWARDS, DAILY_CAPS } from "@/lib/xp/rewards";
import { checkAndGrantAchievements } from "@/lib/achievements/check";

export type GradeResult =
  | {
      ok: true;
      xpEarned: number;
      graduated: boolean;
      nextDueAt: string;
    }
  | { error: string };

export async function gradeCard(itemId: string, quality: number): Promise<GradeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [item] = await db
    .select()
    .from(schema.vocabItems)
    .where(and(eq(schema.vocabItems.id, itemId), eq(schema.vocabItems.userId, user.id)))
    .limit(1);
  if (!item) return { error: "Card not found" };

  const state = {
    ease: Number(item.ease),
    intervalDays: item.intervalDays,
    repetitions: item.repetitions,
  };
  const review = rate(state, quality);

  const wasAlreadyGraduated = item.intervalDays >= SRS_GRADUATED_INTERVAL_DAYS;
  const isNowGraduated = review.intervalDays >= SRS_GRADUATED_INTERVAL_DAYS;
  const justGraduated = !wasAlreadyGraduated && isNowGraduated && !review.lapsed;

  await db
    .update(schema.vocabItems)
    .set({
      ease: review.ease.toString(),
      intervalDays: review.intervalDays,
      repetitions: review.repetitions,
      dueAt: review.dueAt,
      lastReviewedAt: new Date(),
      lapses: review.lapsed ? item.lapses + 1 : item.lapses,
    })
    .where(eq(schema.vocabItems.id, itemId));

  let xpEarned = 0;

  // SRS review XP (capped daily)
  const todayReviews = await todayXp(user.id, "srs_review");
  const reviewXpAvailable = Math.max(0, DAILY_CAPS.srsReview - todayReviews);
  if (reviewXpAvailable > 0) {
    xpEarned += await grantXp({
      userId: user.id,
      delta: Math.min(XP_REWARDS.srsReview, reviewXpAvailable),
      reason: "srs_review",
      ref: { itemId },
    });
  }

  // Graduation bonus (idempotent per item)
  if (justGraduated) {
    xpEarned += await grantXp({
      userId: user.id,
      delta: XP_REWARDS.vocabGraduated,
      reason: "vocab_learned",
      ref: { itemId },
      refHash: `vocab_graduated:${itemId}`,
    });
  }

  await recordActivity(user.id);
  await checkAndGrantAchievements(user.id);
  revalidatePath("/review");

  return {
    ok: true,
    xpEarned,
    graduated: justGraduated,
    nextDueAt: review.dueAt.toISOString(),
  };
}
