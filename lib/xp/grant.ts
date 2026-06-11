import { sql, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

type XpReason = (typeof schema.xpReason.enumValues)[number];

/**
 * Grants XP idempotently: a stable refHash means the same event can never
 * double-grant. Pass a unique hash (e.g. with a timestamp) for repeatable
 * events like SRS reviews.
 */
export async function grantXp(
  userId: string,
  delta: number,
  reason: XpReason,
  refHash: string,
  ref?: Record<string, unknown>,
): Promise<boolean> {
  const inserted = await db
    .insert(schema.xpEvents)
    .values({ userId, delta, reason, refHash, ref })
    .onConflictDoNothing()
    .returning({ id: schema.xpEvents.id });

  if (inserted.length === 0) return false;

  await db
    .update(schema.profiles)
    .set({ xpTotal: sql`${schema.profiles.xpTotal} + ${delta}` })
    .where(eq(schema.profiles.id, userId));

  await recordStreakActivity(userId);
  return true;
}

async function recordStreakActivity(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(schema.streaks)
    .where(eq(schema.streaks.userId, userId))
    .limit(1);

  const streak = rows[0];
  if (!streak) {
    await db
      .insert(schema.streaks)
      .values({ userId, currentDays: 1, longestDays: 1, lastActiveDate: today })
      .onConflictDoNothing();
    return;
  }

  if (streak.lastActiveDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const continues = streak.lastActiveDate === yesterday;
  const current = continues ? streak.currentDays + 1 : 1;

  await db
    .update(schema.streaks)
    .set({
      currentDays: current,
      longestDays: Math.max(current, streak.longestDays),
      lastActiveDate: today,
    })
    .where(eq(schema.streaks.userId, userId));
}
