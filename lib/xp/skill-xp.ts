import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { rankForXp } from "./curve";
import { skillForReason, SKILLS, type Skill } from "./skills";

export type SkillRankInfo = {
  skill: Skill;
  xp: number;
  rank: number;
  xpInRank: number;
  xpToNext: number;
};

export type SkillRanks = {
  skills: SkillRankInfo[];
  /** Lowest of the three ranks — the "you're only as strong as…" nudge. */
  overallRank: number;
};

/** Sum xp_events per skill for a user and derive ranks from the XP curve. */
export async function getSkillRanks(userId: string): Promise<SkillRanks> {
  const rows = await db
    .select({
      reason: schema.xpEvents.reason,
      total: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)`,
    })
    .from(schema.xpEvents)
    .where(eq(schema.xpEvents.userId, userId))
    .groupBy(schema.xpEvents.reason);

  const xp: Record<Skill, number> = { reading: 0, listening: 0, speaking: 0 };
  for (const row of rows) {
    const skill = skillForReason(row.reason);
    if (skill) xp[skill] += Number(row.total);
  }

  const skills = SKILLS.map((skill) => {
    const { rank, xpInRank, xpToNext } = rankForXp(xp[skill]);
    return { skill, xp: xp[skill], rank, xpInRank, xpToNext };
  });

  return { skills, overallRank: Math.min(...skills.map((s) => s.rank)) };
}
