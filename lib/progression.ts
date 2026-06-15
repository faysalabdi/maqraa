import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { grantXp } from "@/lib/xp/grant";
import { XP_REWARDS } from "@/lib/xp/rewards";

/**
 * Count the catalogue books the user has completed at a given level. Completing
 * the books on the curated path is what clears a stage and moves the path
 * forward.
 */
export async function completedAtLevel(userId: string, level: number): Promise<number> {
  const [books] = await db
    .select({ cnt: count() })
    .from(schema.userBooks)
    .innerJoin(schema.books, eq(schema.userBooks.bookId, schema.books.id))
    .where(
      and(
        eq(schema.userBooks.userId, userId),
        eq(schema.userBooks.status, "completed"),
        eq(schema.books.level, level),
      ),
    );

  return Number(books?.cnt ?? 0);
}

/**
 * Advance the user's level if they've cleared enough reading at their current
 * level. Idempotent — the level_up XP grant is keyed by the transition.
 * Returns the new level if a level-up happened, otherwise null.
 */
export async function maybeLevelUp(userId: string, atLevel: number): Promise<number | null> {
  const [levelRow] = await db
    .select()
    .from(schema.levels)
    .where(eq(schema.levels.level, atLevel))
    .limit(1);
  if (!levelRow) return null;

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1);
  // Only books at the user's current level move the path forward.
  if (!profile || profile.currentLevel !== atLevel) return null;

  const cleared = await completedAtLevel(userId, atLevel);
  if (cleared < levelRow.booksRequiredToClear) return null;

  const nextLevel = atLevel + 1;
  await db
    .update(schema.profiles)
    .set({ currentLevel: nextLevel, updatedAt: new Date() })
    .where(eq(schema.profiles.id, userId));

  await grantXp({
    userId,
    delta: XP_REWARDS.levelUp,
    reason: "level_up",
    ref: { from: atLevel, to: nextLevel },
    refHash: `level_up:${atLevel}_to_${nextLevel}`,
  });

  return nextLevel;
}
