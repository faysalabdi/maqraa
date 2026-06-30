import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { BookCheck, Brain, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { XpChart, type XpDay } from "@/components/stats/XpChart";
import { DailyGoalRing } from "@/components/stats/DailyGoalRing";
import { StageCard, StreakBanner, AchievementsPreview } from "@/components/stats/ProgressHub";
import { getAchievementsSummary } from "@/lib/achievements/server";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/stats");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 13);

  const [profileRows, streakRows, xpByDayRows, booksRows, vocabRows, levelRows, completedRows] =
    await Promise.all([
      db.select().from(schema.profiles).where(eq(schema.profiles.id, user.id)).limit(1),
      db.select().from(schema.streaks).where(eq(schema.streaks.userId, user.id)).limit(1),
      db
        .select({
          date: sql<string>`to_char(${schema.xpEvents.occurredAt}, 'YYYY-MM-DD')`,
          total: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)`,
        })
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.userId, user.id), gte(schema.xpEvents.occurredAt, start)))
        .groupBy(sql`to_char(${schema.xpEvents.occurredAt}, 'YYYY-MM-DD')`),
      db
        .select({ c: count() })
        .from(schema.userBooks)
        .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.status, "completed"))),
      db.select({ c: count() }).from(schema.vocabItems).where(eq(schema.vocabItems.userId, user.id)),
      db.select().from(schema.levels).orderBy(asc(schema.levels.level)),
      db
        .select({ level: schema.books.level })
        .from(schema.userBooks)
        .innerJoin(schema.books, eq(schema.userBooks.bookId, schema.books.id))
        .where(and(eq(schema.userBooks.userId, user.id), eq(schema.userBooks.status, "completed"))),
    ]);

  // Light read-only summary for the preview; awarding happens on /achievements
  // and via the watcher, so the stats page stays cheap.
  const achievements = await getAchievementsSummary(user.id);

  const profile = profileRows[0];
  const streak = streakRows[0];
  const booksDone = Number(booksRows[0]?.c ?? 0);
  const wordsSaved = Number(vocabRows[0]?.c ?? 0);
  const dailyGoal = profile?.dailyXpGoal ?? 50;

  const dayMap = new Map(xpByDayRows.map((r) => [r.date, Number(r.total)]));
  const days: XpDay[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, total: dayMap.get(key) ?? 0 });
  }
  const maxXp = Math.max(1, ...days.map((d) => d.total));
  const xpToday = days[days.length - 1]?.total ?? 0;

  // Current stage = the first level not yet cleared (completed < required).
  const completedByLevel = new Map<number, number>();
  for (const r of completedRows)
    completedByLevel.set(r.level, (completedByLevel.get(r.level) ?? 0) + 1);
  const rawIdx = levelRows.findIndex(
    (l) => (completedByLevel.get(l.level) ?? 0) < l.booksRequiredToClear,
  );
  const stage = levelRows.length
    ? levelRows[rawIdx === -1 ? levelRows.length - 1 : rawIdx]
    : null;
  const nextStage = stage ? levelRows.find((l) => l.level === stage.level + 1) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-6 md:pt-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Your progress</h1>
        <p className="mt-1 text-sm text-fg-muted">Everything you&apos;ve read, saved, and earned.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <DailyGoalRing value={xpToday} goal={dailyGoal} />
        {stage && (
          <StageCard
            level={stage.level}
            nameEn={stage.nameEn}
            nameAr={stage.nameAr}
            booksInLevel={completedByLevel.get(stage.level) ?? 0}
            booksRequired={stage.booksRequiredToClear}
            nextName={nextStage?.nameEn ?? null}
          />
        )}
      </div>

      <StreakBanner
        current={streak?.currentDays ?? 0}
        longest={streak?.longestDays ?? 0}
        freezes={streak?.freezesRemaining ?? 2}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OutcomeCard
          icon={<BookCheck className="h-4 w-4" />}
          tile="bg-brand/10 text-brand"
          num="text-brand"
          value={booksDone}
          label="Books finished"
        />
        <OutcomeCard
          icon={<Brain className="h-4 w-4" />}
          tile="bg-iris/10 text-iris"
          num="text-iris"
          value={wordsSaved}
          label="Words saved"
        />
        <OutcomeCard
          icon={<Flame className="h-4 w-4" />}
          tile="bg-flame/10 text-flame"
          num="text-flame"
          value={streak?.currentDays ?? 0}
          label="Day streak"
        />
        <OutcomeCard
          icon={<Zap className="h-4 w-4" />}
          tile="bg-accent-soft text-accent-fg"
          num="text-accent-fg"
          value={(profile?.xpTotal ?? 0).toLocaleString()}
          label="Total XP"
        />
      </div>

      <XpChart days={days} />

      {/* Activity heatmap (last 14 days) */}
      <section className="rounded-3xl bg-surface p-6 shadow-card ring-1 ring-border">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Recent activity</h2>
          <span className="text-xs text-fg-muted">last 14 days</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => {
            const level = d.total === 0 ? 0 : d.total < maxXp * 0.34 ? 1 : d.total < maxXp * 0.67 ? 2 : 3;
            return (
              <span
                key={d.date}
                title={`${d.date} · ${d.total} XP`}
                className={cn(
                  "h-7 w-7 rounded-md",
                  level === 0 && "bg-bg-muted",
                  level === 1 && "bg-brand/30",
                  level === 2 && "bg-brand/60",
                  level === 3 && "bg-brand",
                )}
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-fg-muted">
          Less
          <span className="h-3 w-3 rounded bg-bg-muted" />
          <span className="h-3 w-3 rounded bg-brand/30" />
          <span className="h-3 w-3 rounded bg-brand/60" />
          <span className="h-3 w-3 rounded bg-brand" />
          More
        </div>
      </section>

      <AchievementsPreview
        items={achievements.items.slice(0, 6)}
        earnedCount={achievements.earnedCount}
        total={achievements.total}
        xpEarned={achievements.xpEarned}
      />
    </main>
  );
}

function OutcomeCard({
  icon,
  tile,
  num,
  value,
  label,
}: {
  icon: React.ReactNode;
  tile: string;
  num: string;
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-3xl bg-surface p-5 shadow-card ring-1 ring-border">
      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", tile)}>{icon}</span>
      <p className={cn("mt-3 text-3xl font-extrabold leading-none", num)}>{value}</p>
      <p className="mt-1.5 text-sm text-fg-muted">{label}</p>
    </div>
  );
}
