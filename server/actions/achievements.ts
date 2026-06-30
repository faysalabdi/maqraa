"use server";

import { createClient } from "@/lib/supabase/server";
import { getAchievements } from "@/lib/achievements/server";

export type EarnedBadge = {
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  xpReward: number;
};

/**
 * Called by the client watcher on navigation: awards anything newly met and
 * returns only the badges it just awarded, so the client can toast them
 * directly (already-earned badges are never returned, so there's no flood and
 * no client-side bookkeeping needed).
 */
export async function syncAchievements(): Promise<{ earned: EarnedBadge[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { earned: [] };

  const { newly } = await getAchievements(user.id);
  return {
    earned: newly.map((b) => ({
      slug: b.slug,
      nameEn: b.nameEn,
      nameAr: b.nameAr,
      icon: b.icon,
      xpReward: b.xpReward,
    })),
  };
}
