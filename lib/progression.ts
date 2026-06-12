import { and, count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { grantXp } from "@/lib/xp/grant";
import { XP_REWARDS } from "@/lib/xp/rewards";

/**
 * Count everything that clears stages at a given level: catalogue books the
 * user passed the whole-book test on, plus personal texts (generated stories,
 * imported PDFs, pasted texts) where every section's comprehension check was
 * passed.
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

  const [texts] = await db
    .select({ cnt: count() })
    .from(schema.userTexts)
    .where(
      and(
        eq(schema.userTexts.userId, userId),
        eq(schema.userTexts.level, level),
        sql`${schema.userTexts.totalSections} > 0`,
        sql`jsonb_array_length(${schema.userTexts.completedSections}) >= ${schema.userTexts.totalSections}`,
      ),
    );

  return Number(books?.cnt ?? 0) + Number(texts?.cnt ?? 0);
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
  // Only books/texts at the user's current level move the path forward.
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
