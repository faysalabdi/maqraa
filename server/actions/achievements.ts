"use server";

import { createClient } from "@/lib/supabase/server";
import { awardNewAchievements, loadAchievementsView } from "@/lib/achievements/server";

export type EarnedBadge = {
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  xpReward: number;
};

/**
 * Called by the client watcher on each navigation: awards anything newly met,
 * then returns the full earned set so the client can toast whatever it hasn't
 * acknowledged yet (tracked in localStorage).
 */
export async function syncAchievements(): Promise<{ earned: EarnedBadge[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { earned: [] };

  await awardNewAchievements(user.id);
  const view = await loadAchievementsView(user.id);
  const earned = view.items
    .filter((i) => i.earned)
    .map((i) => ({
      slug: i.slug,
      nameEn: i.nameEn,
      nameAr: i.nameAr,
      icon: i.icon,
      xpReward: i.xpReward,
    }));
  return { earned };
}
