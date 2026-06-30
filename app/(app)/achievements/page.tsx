import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { awardNewAchievements, loadAchievementsView } from "@/lib/achievements/server";
import { AchievementsBoard } from "@/components/achievements/AchievementsBoard";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/achievements");

  // Award anything newly met on visit, then read the fresh view.
  await awardNewAchievements(user.id);
  const view = await loadAchievementsView(user.id);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pt-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Achievements</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Earn XP for real milestones — reading, reviewing, finishing, showing up.
        </p>
      </header>
      <AchievementsBoard
        items={view.items}
        earnedCount={view.earnedCount}
        total={view.total}
        xpEarned={view.xpEarned}
        xpRemaining={view.xpRemaining}
      />
    </main>
  );
}
