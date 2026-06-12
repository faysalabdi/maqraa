"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { grantXp, recordActivity } from "@/lib/xp/grant";
import { QUEST_XP, ALL_QUESTS_BONUS_XP } from "@/lib/quests/daily";
import {
  getDailyQuestState,
  questRefHash,
  allBonusRefHash,
} from "@/lib/quests/progress";

export async function claimQuest(
  questId: string,
): Promise<{ xpEarned: number; allBonus: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const state = await getDailyQuestState(user.id);
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest) return { error: "Not one of today's quests" };
  if (quest.claimed) return { xpEarned: 0, allBonus: false };
  if (quest.progress < quest.target) return { error: "Quest not complete yet" };

  let xpEarned = await grantXp({
    userId: user.id,
    delta: QUEST_XP,
    reason: "achievement",
    ref: { quest: questId, date: state.dateKey },
    refHash: questRefHash(state.dateKey, questId),
  });

  // All three claimed today → one-time bonus.
  let allBonus = false;
  const others = state.quests.filter((q) => q.id !== questId);
  if (xpEarned > 0 && others.every((q) => q.claimed)) {
    const bonus = await grantXp({
      userId: user.id,
      delta: ALL_QUESTS_BONUS_XP,
      reason: "achievement",
      ref: { quest: "all", date: state.dateKey },
      refHash: allBonusRefHash(state.dateKey),
    });
    if (bonus > 0) {
      xpEarned += bonus;
      allBonus = true;
    }
  }

  await recordActivity(user.id);
  revalidatePath("/path");
  return { xpEarned, allBonus };
}
