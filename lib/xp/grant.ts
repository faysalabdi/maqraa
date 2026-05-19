"use server";

import { db, schema } from "@/lib/db";
import { eq, and, gte, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { streakDayXp } from "./rewards";

type XpReason = InferSelectModel<typeof schema.xpEvents>["reason"];

/**
 * Grant XP to a user. Idempotent via refHash.
 * Returns delta actually granted (0 if duplicate).
 */
export async function grantXp({
  userId,
  delta,
  reason,
  ref,
  refHash,
}: {
  userId: string;
  delta: number;
  reason: XpReason;
  ref?: Record<string, unknown>;
  refHash?: string;
}): Promise<number> {
  if (delta <= 0) return 0;

  try {
    await db.insert(schema.xpEvents).values({
      userId,
      delta,
      reason,
      ref: ref ?? null,
      refHash: refHash ?? null,
    });
  } catch {
    // unique constraint on (userId, reason, refHash) — duplicate, skip
    return 0;
  }

  await db
    .update(schema.profiles)
    .set({ xpTotal: sql`${schema.profiles.xpTotal} + ${delta}`, updatedAt: new Date() })
    .where(eq(schema.profiles.id, userId));

  return delta;
}

/** Sum XP granted today for a reason, to enforce daily caps. */
export async function todayXp(userId: string, reason: XpReason): Promise<number> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.xpEvents.delta}),0)` })
    .from(schema.xpEvents)
    .where(
      and(
        eq(schema.xpEvents.userId, userId),
        eq(schema.xpEvents.reason, reason),
        gte(schema.xpEvents.occurredAt, midnight),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

/** Record activity for streak tracking. Called after any XP grant. */
export async function recordActivity(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const rows = await db
    .select()
    .from(schema.streaks)
    .where(eq(schema.streaks.userId, userId))
    .limit(1);

  let newCurrent: number;

  if (rows.length === 0) {
    await db.insert(schema.streaks).values({
      userId,
      currentDays: 1,
      longestDays: 1,
      lastActiveDate: today,
      freezesRemaining: 2,
    });
    newCurrent = 1;
  } else {
    const streak = rows[0];
    if (streak.lastActiveDate === today) return; // already counted

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().slice(0, 10);

    let freezes = streak.freezesRemaining;

    if (streak.lastActiveDate === yStr) {
      newCurrent = streak.currentDays + 1;
    } else {
      // missed day(s)
      if (freezes > 0) {
        newCurrent = streak.currentDays + 1;
        freezes -= 1;
      } else {
        newCurrent = 1;
      }
    }

    await db
      .update(schema.streaks)
      .set({
        currentDays: newCurrent,
        longestDays: Math.max(newCurrent, streak.longestDays),
        lastActiveDate: today,
        freezesRemaining: freezes,
      })
      .where(eq(schema.streaks.userId, userId));
  }

  // Streak day XP — idempotent per (user, date)
  await grantXp({
    userId,
    delta: streakDayXp(newCurrent),
    reason: "streak_day",
    ref: { streakDay: newCurrent, date: today },
    refHash: `streak_day:${today}`,
  });
}

