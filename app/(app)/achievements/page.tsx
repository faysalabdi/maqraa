import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  AchievementCard,
  type AchievementCardData,
} from "@/components/achievements/AchievementCard";
import { Award } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/achievements");

  const [allAchievements, ownedRows] = await Promise.all([
    db.select().from(schema.achievements),
    db
      .select()
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, user.id)),
  ]);

  const ownedMap = new Map(ownedRows.map((r) => [r.achievementId, r.earnedAt]));

  const cards: AchievementCardData[] = allAchievements
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      nameEn: a.nameEn,
      nameAr: a.nameAr,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      earnedAt: ownedMap.get(a.id) ?? null,
    }))
    .sort((a, b) => {
      // Earned first, then by xpReward asc
      if (a.earnedAt && !b.earnedAt) return -1;
      if (!a.earnedAt && b.earnedAt) return 1;
      return a.xpReward - b.xpReward;
    });

  const earnedCount = cards.filter((c) => c.earnedAt).length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <section className="rounded-3xl bg-gradient-to-br from-amber-100 via-amber-50 to-white p-6 shadow-lift ring-1 ring-amber-200">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-soft">
            <Award className="h-7 w-7" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Achievements
            </p>
            <h1 className="text-2xl font-extrabold">
              {earnedCount} / {cards.length} earned
            </h1>
            <p className="text-sm text-fg-muted">
              Earned automatically as you read, test, and review.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <AchievementCard key={c.id} ach={c} />
        ))}
      </section>
    </main>
  );
}
