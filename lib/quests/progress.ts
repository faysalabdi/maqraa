import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  questsForDate,
  questDateKey,
  QUEST_XP,
  ALL_QUESTS_BONUS_XP,
  type QuestDef,
} from "./daily";

export type QuestProgress = QuestDef & {
  progress: number;
  claimed: boolean;
  claimable: boolean;
};

export type DailyQuestState = {
  dateKey: string;
  quests: QuestProgress[];
  allClaimed: boolean;
  questXp: number;
  allBonusXp: number;
};

export function questRefHash(dateKey: string, questId: string): string {
  return `quest:${dateKey}:${questId}`;
}

export function allBonusRefHash(dateKey: string): string {
  return `quest_all:${dateKey}`;
}

/** Today's quests with live progress (event counts since UTC midnight). */
export async function getDailyQuestState(userId: string): Promise<DailyQuestState> {
  const now = new Date();
  const dateKey = questDateKey(now);
  const utcMidnight = new Date(`${dateKey}T00:00:00.000Z`);
  const quests = questsForDate(now);

  const [counts, claims] = await Promise.all([
    db
      .select({
        reason: schema.xpEvents.reason,
        cnt: sql<number>`count(*)`,
      })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.userId, userId),
          gte(schema.xpEvents.occurredAt, utcMidnight),
        ),
      )
      .groupBy(schema.xpEvents.reason),
    db
      .select({ refHash: schema.xpEvents.refHash })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.userId, userId),
          eq(schema.xpEvents.reason, "achievement"),
          inArray(
            schema.xpEvents.refHash,
            quests.map((q) => questRefHash(dateKey, q.id)),
          ),
        ),
      ),
  ]);

  const countByReason = new Map(counts.map((c) => [c.reason as string, Number(c.cnt)]));
  const claimedSet = new Set(claims.map((c) => c.refHash));

  const withProgress: QuestProgress[] = quests.map((q) => {
    const progress = Math.min(q.target, countByReason.get(q.reason) ?? 0);
    const claimed = claimedSet.has(questRefHash(dateKey, q.id));
    return { ...q, progress, claimed, claimable: !claimed && progress >= q.target };
  });

  return {
    dateKey,
    quests: withProgress,
    allClaimed: withProgress.every((q) => q.claimed),
    questXp: QUEST_XP,
    allBonusXp: ALL_QUESTS_BONUS_XP,
  };
}
