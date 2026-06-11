import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { Award, BookOpen, Flame, Languages, Sparkles, Target, Trophy, Zap } from "lucide-react";
import { XpChart, type XpDay } from "@/components/stats/XpChart";
import { StatGrid, type StatTile } from "@/components/stats/StatGrid";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { strengthFor, STRENGTH_META, STRENGTH_ORDER, type Strength } from "@/lib/srs/strength";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?redirect=/stats");

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setHours(0, 0, 0, 0);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

  const [
    profileRows,
    streakRows,
    xpByDayRows,
    booksRows,
    attemptsRows,
    vocabRows,
    achievementsRows,
  ] = await Promise.all([
    db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, user.id))
      .limit(1),
    db
      .select()
      .from(schema.streaks)
      .where(eq(schema.streaks.userId, user.id))
      .limit(1),
    db
      .select({
        date: sql<string>`to_char(${schema.xpEvents.occurredAt}, 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)`,
      })
      .from(schema.xpEvents)
      .where(
        and(
          eq(schema.xpEvents.userId, user.id),
          gte(schema.xpEvents.occurredAt, fourteenDaysAgo),
        ),
      )
      .groupBy(sql`to_char(${schema.xpEvents.occurredAt}, 'YYYY-MM-DD')`),
    db
      .select({ status: schema.userBooks.status, cnt: count() })
      .from(schema.userBooks)
      .where(eq(schema.userBooks.userId, user.id))
      .groupBy(schema.userBooks.status),
    db
      .select({ passed: schema.comprehensionAttempts.passed, cnt: count() })
      .from(schema.comprehensionAttempts)
      .where(eq(schema.comprehensionAttempts.userId, user.id))
      .groupBy(schema.comprehensionAttempts.passed),
    db
      .select({
        total: sql<number>`count(*)`,
        due: sql<number>`count(*) filter (where ${schema.vocabItems.dueAt} <= now() and ${schema.vocabItems.suspended} = false)`,
        graduated: sql<number>`count(*) filter (where ${schema.vocabItems.intervalDays} >= 21 and ${schema.vocabItems.lapses} = 0)`,
      })
      .from(schema.vocabItems)
      .where(eq(schema.vocabItems.userId, user.id)),
    db
      .select({ cnt: count() })
      .from(schema.userAchievements)
      .where(eq(schema.userAchievements.userId, user.id)),
  ]);

  const profile = profileRows[0];
  const streak = streakRows[0];

  // Build a 14-day series with zero fill
  const dayMap = new Map(xpByDayRows.map((r) => [r.date, Number(r.total)]));
  const days: XpDay[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, total: dayMap.get(key) ?? 0 });
  }

  const booksByStatus = new Map(booksRows.map((r) => [r.status, Number(r.cnt)]));
  const totalCompleted = booksByStatus.get("completed") ?? 0;
  const inProgress =
    (booksByStatus.get("in_progress") ?? 0) +
    (booksByStatus.get("reading_done") ?? 0) +
    (booksByStatus.get("testing") ?? 0) +
    (booksByStatus.get("failed_retry") ?? 0);

  const passedTests =
    attemptsRows.find((r) => r.passed === true)?.cnt ?? 0;
  const failedTests =
    attemptsRows.find((r) => r.passed === false)?.cnt ?? 0;

  const vocab = vocabRows[0];
  const earnedAchievements = Number(achievementsRows[0]?.cnt ?? 0);

  const tiles: StatTile[] = [
    {
      label: "Total XP",
      value: (profile?.xpTotal ?? 0).toLocaleString(),
      icon: <Zap className="h-3.5 w-3.5" />,
      tone: "amber",
    },
    {
      label: "Level",
      value: profile?.currentLevel ?? 1,
      sub: "Current stage",
      icon: <Sparkles className="h-3.5 w-3.5" />,
      tone: "brand",
    },
    {
      label: "Streak",
      value: streak?.currentDays ?? 0,
      sub: `Best ${streak?.longestDays ?? 0} day${(streak?.longestDays ?? 0) === 1 ? "" : "s"}`,
      icon: <Flame className="h-3.5 w-3.5" />,
      tone: "flame",
    },
    {
      label: "Daily goal",
      value: `${profile?.dailyXpGoal ?? 50} XP`,
      sub: "Per day",
      icon: <Target className="h-3.5 w-3.5" />,
      tone: "neutral",
    },
    {
      label: "Books done",
      value: totalCompleted,
      sub: `${inProgress} in progress`,
      icon: <BookOpen className="h-3.5 w-3.5" />,
      tone: "brand",
    },
    {
      label: "Tests",
      value: `${Number(passedTests)}/${Number(passedTests) + Number(failedTests)}`,
      sub: "Passed / taken",
      icon: <Trophy className="h-3.5 w-3.5" />,
      tone: "amber",
    },
    {
      label: "Vocab",
      value: Number(vocab?.total ?? 0),
      sub: `${Number(vocab?.due ?? 0)} due · ${Number(vocab?.graduated ?? 0)} mature`,
      icon: <Languages className="h-3.5 w-3.5" />,
      tone: "neutral",
    },
    {
      label: "Awards",
      value: earnedAchievements,
      sub: "Earned",
      icon: <Award className="h-3.5 w-3.5" />,
      tone: "amber",
    },
  ];

  const allWords = await db
    .select()
    .from(schema.vocabItems)
    .where(eq(schema.vocabItems.userId, user.id));
  const strengthCounts = new Map<Strength, number>();
  for (const st of STRENGTH_ORDER) strengthCounts.set(st, 0);
  for (const w of allWords) {
    const st = strengthFor({ ...w, ease: Number(w.ease) });
    strengthCounts.set(st, (strengthCounts.get(st) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-24 pt-6">
      <header>
        <h1 className="text-3xl font-extrabold">Your stats</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Everything you&apos;ve earned, read, and reviewed.
        </p>
      </header>

      <StatGrid tiles={tiles} />

      <XpChart days={days} />

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-border">
        <h2 className="mb-4 text-lg font-bold">Vocabulary strength</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          {STRENGTH_ORDER.map((st) => (
            <div key={st} className={cn("rounded-2xl p-3 ring-1", STRENGTH_META[st].color)}>
              <p className="text-2xl font-extrabold">{strengthCounts.get(st)}</p>
              <p className="text-[11px] font-semibold">{STRENGTH_META[st].labelEn}</p>
            </div>
          ))}
        </div>
        <Link
          href="/words"
          className="mt-4 block text-center text-sm font-semibold text-brand hover:underline"
        >
          See all words →
        </Link>
      </section>
    </main>
  );
}
