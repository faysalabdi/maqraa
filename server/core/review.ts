import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { rate, SRS_GRADUATED_INTERVAL_DAYS } from "@/lib/srs/sm2";
import { grantXp, todayXp, recordActivity } from "@/lib/xp/grant";
import { XP_REWARDS, DAILY_CAPS } from "@/lib/xp/rewards";
import type { CoreUser } from "./user";

export type GradeResult =
  | {
      ok: true;
      xpEarned: number;
      graduated: boolean;
      nextDueAt: string;
    }
  | { error: string };

export async function gradeCardCore(
  user: CoreUser,
  itemId: string,
  quality: number,
): Promise<GradeResult> {
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

  // SRS review XP (capped daily, idempotent per item per day)
  const todayReviews = await todayXp(user.id, "srs_review");
  const reviewXpAvailable = Math.max(0, DAILY_CAPS.srsReview - todayReviews);
  if (reviewXpAvailable > 0) {
    const today = new Date().toISOString().slice(0, 10);
    xpEarned += await grantXp({
      userId: user.id,
      delta: Math.min(XP_REWARDS.srsReview, reviewXpAvailable),
      reason: "srs_review",
      ref: { itemId },
      refHash: `srs_review:${itemId}:${today}`,
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

  return {
    ok: true,
    xpEarned,
    graduated: justGraduated,
    nextDueAt: review.dueAt.toISOString(),
  };
}

export type PracticeResult = { ok: true; xpEarned: number } | { error: string };

/**
 * Free practice: drill a word without touching its spaced-repetition schedule.
 * Ease, interval, repetitions and dueAt are all left untouched, so cramming
 * here can never distort when the card is actually due. The only side effects
 * are a small, daily-capped XP grant (idempotent per word per day, so it can't
 * be farmed) and keeping the streak alive.
 */
export async function practiceCardCore(user: CoreUser, itemId: string): Promise<PracticeResult> {
  const [item] = await db
    .select({ id: schema.vocabItems.id })
    .from(schema.vocabItems)
    .where(and(eq(schema.vocabItems.id, itemId), eq(schema.vocabItems.userId, user.id)))
    .limit(1);
  if (!item) return { error: "Card not found" };

  let xpEarned = 0;
  // Shares the SRS daily cap so practice + review together stay bounded.
  const todayReviews = await todayXp(user.id, "srs_review");
  const available = Math.max(0, DAILY_CAPS.srsReview - todayReviews);
  if (available > 0) {
    const today = new Date().toISOString().slice(0, 10);
    xpEarned += await grantXp({
      userId: user.id,
      delta: Math.min(XP_REWARDS.srsReview, available),
      reason: "srs_review",
      ref: { itemId, practice: true },
      refHash: `practice:${itemId}:${today}`,
    });
  }

  await recordActivity(user.id);
  return { ok: true, xpEarned };
}
