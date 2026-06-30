import { and, count, countDistinct, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { grantXp } from "@/lib/xp/grant";
import { SRS_GRADUATED_INTERVAL_DAYS } from "@/lib/srs/sm2";

/**
 * The achievement engine. The `achievements` table + 11 seeded badges already
 * exist; this turns them on by computing progress toward each from the same
 * sources their criteria reference and awarding + granting XP the moment they
 * are met. Idempotent throughout (PK on user_achievements, grantXp refHash).
 *
 * Every public function is defensive: if the achievements/user_achievements
 * tables are missing or a query fails, it returns an empty result rather than
 * throwing, so a stats/achievements page never crashes over gamification.
 */

export type Criteria =
  | { type: "books_completed"; count: number }
  | { type: "tests_passed"; count: number }
  | { type: "perfect_tests"; count: number }
  | { type: "vocab_graduated"; count: number }
  | { type: "vocab_count"; count: number }
  | { type: "streak_days"; count: number }
  | { type: "freeze_used"; count: number }
  | { type: "genre_variety" };

export type AchievementView = {
  slug: string;
  nameEn: string;
  nameAr: string;
  description: string;
  icon: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
  current: number;
  target: number;
  unit: string;
};

export type AchievementsResult = {
  items: AchievementView[];
  earnedCount: number;
  total: number;
  xpEarned: number;
  xpRemaining: number;
  newly: AchievementView[];
};

export type SummaryBadge = { slug: string; icon: string; nameEn: string; earned: boolean };
export type AchievementsSummary = {
  items: SummaryBadge[];
  earnedCount: number;
  total: number;
  xpEarned: number;
};

type Snapshot = {
  booksCompleted: number;
  testsPassed: number;
  perfectTests: number;
  vocabCount: number;
  vocabGraduated: number;
  longestStreak: number;
  freezesUsed: number;
  genreVariety: number;
};

type AchievementRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  description: string;
  icon: string;
  xpReward: number;
  criteria: unknown;
};

const REQUIRED_GENRES = ["islamic", "arabic_literature", "translated"] as const;
const STARTING_FREEZES = 2;

async function computeSnapshot(userId: string): Promise<Snapshot> {
  const [booksRows, passedRows, perfectRows, vocabRows, gradRows, streakRows, genreRows] =
    await Promise.all([
      db
        .select({ c: count() })
        .from(schema.userBooks)
        .where(and(eq(schema.userBooks.userId, userId), eq(schema.userBooks.status, "completed"))),
      db
        .select({ c: countDistinct(schema.comprehensionAttempts.bookId) })
        .from(schema.comprehensionAttempts)
        .where(
          and(
            eq(schema.comprehensionAttempts.userId, userId),
            eq(schema.comprehensionAttempts.passed, true),
          ),
        ),
      db
        .select({ c: countDistinct(schema.comprehensionAttempts.bookId) })
        .from(schema.comprehensionAttempts)
        .where(
          and(
            eq(schema.comprehensionAttempts.userId, userId),
            gte(schema.comprehensionAttempts.score, "100"),
          ),
        ),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(eq(schema.vocabItems.userId, userId)),
      db
        .select({ c: count() })
        .from(schema.vocabItems)
        .where(
          and(
            eq(schema.vocabItems.userId, userId),
            gte(schema.vocabItems.intervalDays, SRS_GRADUATED_INTERVAL_DAYS),
          ),
        ),
      db
        .select({ longest: schema.streaks.longestDays, freezes: schema.streaks.freezesRemaining })
        .from(schema.streaks)
        .where(eq(schema.streaks.userId, userId))
        .limit(1),
      db
        .selectDistinct({ genre: schema.books.genre })
        .from(schema.userBooks)
        .innerJoin(schema.books, eq(schema.userBooks.bookId, schema.books.id))
        .where(and(eq(schema.userBooks.userId, userId), eq(schema.userBooks.status, "completed"))),
    ]);

  const genres = new Set(genreRows.map((g) => g.genre));
  const freezesRemaining = streakRows[0]?.freezes ?? STARTING_FREEZES;

  return {
    booksCompleted: Number(booksRows[0]?.c ?? 0),
    testsPassed: Number(passedRows[0]?.c ?? 0),
    perfectTests: Number(perfectRows[0]?.c ?? 0),
    vocabCount: Number(vocabRows[0]?.c ?? 0),
    vocabGraduated: Number(gradRows[0]?.c ?? 0),
    longestStreak: streakRows[0]?.longest ?? 0,
    freezesUsed: Math.max(0, STARTING_FREEZES - freezesRemaining),
    genreVariety: REQUIRED_GENRES.filter((g) => genres.has(g)).length,
  };
}

function unitFor(criteria: Criteria): string {
  switch (criteria.type) {
    case "books_completed":
      return "books";
    case "tests_passed":
      return "tests";
    case "perfect_tests":
      return "perfect";
    case "vocab_graduated":
      return "mastered";
    case "vocab_count":
      return "words";
    case "streak_days":
      return "days";
    case "genre_variety":
      return "genres";
    case "freeze_used":
      return "";
  }
}

function progressFor(criteria: Criteria, s: Snapshot): { current: number; target: number } {
  switch (criteria.type) {
    case "books_completed":
      return { current: s.booksCompleted, target: criteria.count };
    case "tests_passed":
      return { current: s.testsPassed, target: criteria.count };
    case "perfect_tests":
      return { current: s.perfectTests, target: criteria.count };
    case "vocab_graduated":
      return { current: s.vocabGraduated, target: criteria.count };
    case "vocab_count":
      return { current: s.vocabCount, target: criteria.count };
    case "streak_days":
      return { current: s.longestStreak, target: criteria.count };
    case "freeze_used":
      return { current: s.freezesUsed, target: criteria.count };
    case "genre_variety":
      return { current: s.genreVariety, target: REQUIRED_GENRES.length };
  }
}

function viewOf(a: AchievementRow, s: Snapshot, earnedAt: Date | null): AchievementView {
  const c = a.criteria as Criteria;
  const { current, target } = progressFor(c, s);
  return {
    slug: a.slug,
    nameEn: a.nameEn,
    nameAr: a.nameAr,
    description: a.description,
    icon: a.icon,
    xpReward: a.xpReward,
    earned: earnedAt !== null,
    earnedAt: earnedAt ? earnedAt.toISOString() : null,
    current: Math.min(current, target),
    target,
    unit: unitFor(c),
  };
}

function sortView(a: AchievementView, b: AchievementView): number {
  if (a.earned !== b.earned) return a.earned ? -1 : 1;
  if (a.earned && b.earned) return (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "");
  return b.current / b.target - a.current / a.target;
}

const EMPTY_RESULT: AchievementsResult = {
  items: [],
  earnedCount: 0,
  total: 0,
  xpEarned: 0,
  xpRemaining: 0,
  newly: [],
};

/**
 * Single pass: compute the snapshot once, award anything newly met, and build
 * the full view. Used by the /achievements page and the award watcher.
 */
export async function getAchievements(userId: string): Promise<AchievementsResult> {
  try {
    const snapshot = await computeSnapshot(userId);
    const [allAch, earnedRows] = await Promise.all([
      db.select().from(schema.achievements),
      db.select().from(schema.userAchievements).where(eq(schema.userAchievements.userId, userId)),
    ]);
    const earnedAtById = new Map<string, Date>(
      earnedRows.map((r) => [r.achievementId, r.earnedAt]),
    );

    const newly: AchievementView[] = [];
    for (const a of allAch as AchievementRow[]) {
      if (earnedAtById.has(a.id)) continue;
      const { current, target } = progressFor(a.criteria as Criteria, snapshot);
      if (current < target) continue;

      const inserted = await db
        .insert(schema.userAchievements)
        .values({ userId, achievementId: a.id })
        .onConflictDoNothing()
        .returning({ id: schema.userAchievements.achievementId });
      if (inserted.length === 0) continue;

      const now = new Date();
      earnedAtById.set(a.id, now);
      if (a.xpReward > 0) {
        await grantXp({
          userId,
          delta: a.xpReward,
          reason: "achievement",
          ref: { slug: a.slug },
          refHash: `achievement:${a.slug}`,
        });
      }
      newly.push(viewOf(a, snapshot, now));
    }

    const items = (allAch as AchievementRow[])
      .map((a) => viewOf(a, snapshot, earnedAtById.get(a.id) ?? null))
      .sort(sortView);
    const earnedItems = items.filter((i) => i.earned);
    return {
      items,
      earnedCount: earnedItems.length,
      total: items.length,
      xpEarned: earnedItems.reduce((s, i) => s + i.xpReward, 0),
      xpRemaining: items.filter((i) => !i.earned).reduce((s, i) => s + i.xpReward, 0),
      newly,
    };
  } catch (e) {
    console.error("[achievements] getAchievements failed", e);
    return EMPTY_RESULT;
  }
}

/**
 * Lightweight, read-only badge summary for the stats-hub preview: two queries,
 * no snapshot, no awarding. Keeps the stats page cheap.
 */
export async function getAchievementsSummary(userId: string): Promise<AchievementsSummary> {
  try {
    const [allAch, earnedRows] = await Promise.all([
      db
        .select({
          id: schema.achievements.id,
          slug: schema.achievements.slug,
          icon: schema.achievements.icon,
          nameEn: schema.achievements.nameEn,
          xpReward: schema.achievements.xpReward,
        })
        .from(schema.achievements),
      db
        .select({ id: schema.userAchievements.achievementId })
        .from(schema.userAchievements)
        .where(eq(schema.userAchievements.userId, userId)),
    ]);
    const earned = new Set(earnedRows.map((r) => r.id));
    const items: SummaryBadge[] = allAch
      .map((a) => ({ slug: a.slug, icon: a.icon, nameEn: a.nameEn, earned: earned.has(a.id) }))
      .sort((x, y) => (x.earned === y.earned ? 0 : x.earned ? -1 : 1));
    return {
      items,
      earnedCount: items.filter((i) => i.earned).length,
      total: allAch.length,
      xpEarned: allAch
        .filter((a) => earned.has(a.id))
        .reduce((s, a) => s + a.xpReward, 0),
    };
  } catch (e) {
    console.error("[achievements] getAchievementsSummary failed", e);
    return { items: [], earnedCount: 0, total: 0, xpEarned: 0 };
  }
}
