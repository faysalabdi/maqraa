import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { evaluateCriteria, type Criteria } from "./criteria";
import { grantXp } from "@/lib/xp/grant";

export type GrantedAchievement = {
  id: string;
  slug: string;
  nameEn: string;
  xpReward: number;
};

/**
 * Evaluate every not-yet-earned achievement for the user.
 * Inserts user_achievements row + grants XP for any newly earned.
 * Returns the list of newly-granted achievements.
 */
export async function checkAndGrantAchievements(
  userId: string,
): Promise<GrantedAchievement[]> {
  const [allAchievements, owned] = await Promise.all([
    db.select().from(schema.achievements),
    db
      .select({ achievementId: schema.userAchievements.achievementId })
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, userId)),
  ]);

  const ownedSet = new Set(owned.map((o) => o.achievementId));
  const granted: GrantedAchievement[] = [];

  for (const ach of allAchievements) {
    if (ownedSet.has(ach.id)) continue;

    let earned = false;
    try {
      earned = await evaluateCriteria(ach.criteria as Criteria, userId);
    } catch (err) {
      console.error(`[achievements] eval ${ach.slug} failed:`, err);
      continue;
    }

    if (!earned) continue;

    try {
      await db.insert(schema.userAchievements).values({
        userId,
        achievementId: ach.id,
      });
    } catch {
      // unique conflict — race; skip
      continue;
    }

    if (ach.xpReward > 0) {
      await grantXp({
        userId,
        delta: ach.xpReward,
        reason: "achievement",
        ref: { achievementSlug: ach.slug },
        refHash: `achievement:${ach.slug}`,
      });
    }

    granted.push({
      id: ach.id,
      slug: ach.slug,
      nameEn: ach.nameEn,
      xpReward: ach.xpReward,
    });
  }

  return granted;
}
