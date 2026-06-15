import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, asc, gte, sql, and } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { PathSection } from "@/components/path/PathSection";
import { JourneyHero, type ContinueBook } from "@/components/path/JourneyHero";
import { SkillRanks } from "@/components/xp/SkillRanks";
import { DailyQuests } from "@/components/quests/DailyQuests";
import { getSkillRanks, type SkillRanks as SkillRanksData } from "@/lib/xp/skill-xp";
import { getDailyQuestState, type DailyQuestState } from "@/lib/quests/progress";
import type { BookNodeData, BookStatus } from "@/lib/db/queries/path";

export const dynamic = "force-dynamic";

// Order in which a reader is nudged through their unfinished books. Anything
// completed drops out of the running for "continue".
const RESUME_PRIORITY: Record<BookStatus, number> = {
  failed_retry: 0,
  testing: 1,
  reading_done: 2,
  in_progress: 3,
  unlocked: 4,
  locked: 99,
  completed: 99,
};

export default async function PathPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    levels,
    allBooks,
  ] = await Promise.all([
    supabase.auth.getUser(),
    db.select().from(schema.levels).orderBy(asc(schema.levels.level)),
    db
      .select()
      .from(schema.books)
      .where(eq(schema.books.hasFullText, true))
      .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
  ]);

  let userLevel = 1;
  let dailyGoal = 50;
  let xpToday = 0;
  let streakDays = 0;
  let longestStreak = 0;
  let displayName: string | null = null;
  let skillRanks: SkillRanksData | null = null;
  let questState: DailyQuestState | null = null;
  const userBookMap = new Map<
    string,
    { status: string; bestScore: string | null; attempts: number }
  >();

  if (user) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    const [profileRows, userBookRows, streakRows, xpRows] = await Promise.all([
      db
        .select({
          currentLevel: schema.profiles.currentLevel,
          dailyXpGoal: schema.profiles.dailyXpGoal,
          displayName: schema.profiles.displayName,
        })
        .from(schema.profiles)
        .where(eq(schema.profiles.id, user.id))
        .limit(1),
      db.select().from(schema.userBooks).where(eq(schema.userBooks.userId, user.id)),
      db
        .select({
          currentDays: schema.streaks.currentDays,
          longestDays: schema.streaks.longestDays,
        })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, user.id))
        .limit(1),
      db
        .select({ total: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)` })
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.userId, user.id), gte(schema.xpEvents.occurredAt, midnight))),
    ]);

    userLevel = profileRows[0]?.currentLevel ?? 1;
    dailyGoal = profileRows[0]?.dailyXpGoal ?? 50;
    displayName = profileRows[0]?.displayName ?? user.email ?? null;
    streakDays = streakRows[0]?.currentDays ?? 0;
    longestStreak = streakRows[0]?.longestDays ?? 0;
    xpToday = Number(xpRows[0]?.total ?? 0);

    [skillRanks, questState] = await Promise.all([
      getSkillRanks(user.id),
      getDailyQuestState(user.id),
    ]);

    for (const r of userBookRows) {
      userBookMap.set(r.bookId, {
        status: r.status,
        bestScore: r.bestScore,
        attempts: r.attempts,
      });
    }
  }

  // Build the journey from readable books only, dropping any stage that has none.
  const path = levels
    .map((lv) => ({
      level: lv.level,
      slug: lv.slug,
      nameEn: lv.nameEn,
      nameAr: lv.nameAr,
      description: lv.description,
      booksRequiredToClear: lv.booksRequiredToClear,
      books: allBooks
        .filter((b) => b.level === lv.level)
        .map<BookNodeData>((b) => {
          const ub = userBookMap.get(b.id);
          const status: BookStatus = ub
            ? (ub.status as BookStatus)
            : b.level <= userLevel
              ? "unlocked"
              : "locked";
          return {
            id: b.id,
            slug: b.slug,
            titleAr: b.titleAr,
            titleEn: b.titleEn,
            authorEn: b.authorEn,
            level: b.level,
            orderInLevel: b.orderInLevel,
            genre: b.genre,
            difficulty: b.difficulty,
            recommendedPages: b.recommendedPages,
            hasFullText: b.hasFullText,
            status,
            bestScore: ub?.bestScore ? Number(ub.bestScore) : null,
            attempts: ub?.attempts ?? 0,
          };
        }),
    }))
    .filter((lv) => lv.books.length > 0);

  // Empty catalogue: nothing readable has been loaded yet.
  if (path.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-12 text-center">
        <div className="rounded-3xl bg-white p-8 shadow-soft ring-1 ring-border">
          <p className="font-arabic text-3xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">No books yet</h1>
          <p className="mt-2 text-sm text-fg-muted">
            No readable books are loaded. Seed the catalogue or add one from the admin panel.
          </p>
        </div>
      </main>
    );
  }

  // Signed-out: a focused invitation, not the full dashboard.
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-dark to-brand p-8 text-center text-brand-fg shadow-lift">
          <p className="font-arabic text-5xl" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-3 text-3xl font-extrabold">Your reading path</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-fg/85">
            Read real Arabic books, tap any word to translate, and level up as you finish them.
          </p>
          <Link
            href="/sign-in?redirect=/path"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-base font-extrabold text-brand transition hover:shadow-lift"
          >
            Sign in to start <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
        <div className="mt-6 space-y-2 opacity-90">
          {path.map((level) => (
            <PathSection key={level.level} level={level} isLocked={level.level > 1} />
          ))}
        </div>
      </main>
    );
  }

  const allNodes = path.flatMap((l) => l.books);
  const totalReadable = allNodes.length;
  const completedReadable = allNodes.filter((b) => b.status === "completed").length;

  // The one book to surface in the hero: the most "owed" unfinished, unlocked book.
  const currentNode = allNodes
    .filter((b) => b.status !== "locked" && b.status !== "completed")
    .sort(
      (a, b) =>
        RESUME_PRIORITY[a.status] - RESUME_PRIORITY[b.status] ||
        a.level - b.level ||
        a.orderInLevel - b.orderInLevel,
    )[0];
  const currentBook: ContinueBook = currentNode
    ? {
        slug: currentNode.slug,
        titleAr: currentNode.titleAr,
        titleEn: currentNode.titleEn,
        status: currentNode.status,
      }
    : null;

  const hasActivity = userBookMap.size > 0 || xpToday > 0;
  const mode = !hasActivity ? "newcomer" : currentBook ? "returning" : "all_done";

  const currentLevelData = path.find((l) => l.level === userLevel) ?? path[0];
  const booksCompletedInLevel = currentLevelData.books.filter(
    (b) => b.status === "completed",
  ).length;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <JourneyHero
        mode={mode}
        displayName={displayName}
        stats={{
          currentLevel: currentLevelData.level,
          levelNameEn: currentLevelData.nameEn,
          levelNameAr: currentLevelData.nameAr,
          booksInLevel: booksCompletedInLevel,
          booksRequired: currentLevelData.booksRequiredToClear,
          xpToday,
          dailyGoal,
          streakDays,
          longestStreak,
        }}
        currentBook={currentBook}
        completedReadable={completedReadable}
        totalReadable={totalReadable}
      />

      {questState && (
        <div className="mt-4">
          <DailyQuests initial={questState} />
        </div>
      )}

      {skillRanks && (
        <div className="mt-4">
          <SkillRanks data={skillRanks} compact />
        </div>
      )}

      <div className="mt-6">
        {path.map((level) => (
          <PathSection key={level.level} level={level} isLocked={level.level > userLevel} />
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-fg-muted">
        More books are added over time. Want a specific title? Let us know.
      </p>
    </main>
  );
}
