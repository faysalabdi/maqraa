import { createClient } from "@/lib/supabase/server";
import { db, schema } from "@/lib/db";
import { eq, asc, gte, sql, and } from "drizzle-orm";
import { PathSection } from "@/components/path/PathSection";
import { ProgressHero } from "@/components/path/ProgressHero";
import type { BookNodeData, BookStatus } from "@/lib/db/queries/path";

export const dynamic = "force-dynamic";

export default async function PathPage() {
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    levels,
    books,
  ] = await Promise.all([
    supabase.auth.getUser(),
    db.select().from(schema.levels).orderBy(asc(schema.levels.level)),
    db
      .select()
      .from(schema.books)
      .orderBy(asc(schema.books.level), asc(schema.books.orderInLevel)),
  ]);

  let userLevel = 1;
  let dailyGoal = 50;
  let xpToday = 0;
  let streakDays = 0;
  let longestStreak = 0;
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
        .select({
          total: sql<number>`coalesce(sum(${schema.xpEvents.delta}), 0)`,
        })
        .from(schema.xpEvents)
        .where(
          and(
            eq(schema.xpEvents.userId, user.id),
            gte(schema.xpEvents.occurredAt, midnight),
          ),
        ),
    ]);

    userLevel = profileRows[0]?.currentLevel ?? 1;
    dailyGoal = profileRows[0]?.dailyXpGoal ?? 50;
    streakDays = streakRows[0]?.currentDays ?? 0;
    longestStreak = streakRows[0]?.longestDays ?? 0;
    xpToday = Number(xpRows[0]?.total ?? 0);

    for (const r of userBookRows) {
      userBookMap.set(r.bookId, {
        status: r.status,
        bestScore: r.bestScore,
        attempts: r.attempts,
      });
    }
  }

  const path = levels.map((lv) => ({
    level: lv.level,
    slug: lv.slug,
    nameEn: lv.nameEn,
    nameAr: lv.nameAr,
    description: lv.description,
    booksRequiredToClear: lv.booksRequiredToClear,
    books: books
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
          status,
          bestScore: ub?.bestScore ? Number(ub.bestScore) : null,
          attempts: ub?.attempts ?? 0,
        };
      }),
  }));

  const currentLevelData = path.find((l) => l.level === userLevel) ?? path[0] ?? null;
  const booksCompletedInLevel =
    currentLevelData?.books.filter((b) => b.status === "completed").length ?? 0;

  if (path.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-12 text-center">
        <div className="rounded-3xl bg-white p-8 shadow-soft ring-1 ring-border">
          <p className="font-arabic text-3xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">Catalogue empty</h1>
          <p className="mt-2 text-sm text-fg-muted">
            No levels in the database yet. Run <code className="rounded bg-bg-muted px-1.5 py-0.5 font-mono text-xs">pnpm db:seed</code> to populate stages and books.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {user && currentLevelData ? (
        <ProgressHero
          currentLevel={currentLevelData.level}
          levelNameEn={currentLevelData.nameEn}
          levelNameAr={currentLevelData.nameAr}
          booksInLevel={booksCompletedInLevel}
          booksRequired={currentLevelData.booksRequiredToClear}
          xpToday={xpToday}
          dailyGoal={dailyGoal}
          streakDays={streakDays}
          longestStreak={longestStreak}
        />
      ) : (
        <div className="rounded-3xl bg-white p-6 text-center shadow-soft ring-1 ring-border">
          <p className="font-arabic text-3xl text-brand" dir="rtl">
            اِقْرَأْ
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">Your reading path</h1>
          <p className="mt-1 text-fg-muted">Sign in to track progress.</p>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {path.map((level) => (
          <PathSection
            key={level.level}
            level={level}
            isLocked={level.level > userLevel}
          />
        ))}
      </div>
    </main>
  );
}
